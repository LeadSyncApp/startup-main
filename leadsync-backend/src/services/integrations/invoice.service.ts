import { prisma } from "../../lib/prisma";
import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";
import { OrderStatus } from "@prisma/client";

class InvoiceService {
    private supabase: any;

    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
        }
    }

    /**
     * Ensures an invoice exists for a paid order.
     * IDEMPOTENT: If invoice exists, returns it.
     */
    async ensureInvoiceForPaidOrder(orderId: string, paymentRef?: string) {
        // 1. Fetch order with details first (bypasses tenant check because it queries by ID)
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                company: true,
                lead: true,
            },
        });

        if (!order) {
            throw new Error("Order not found");
        }

        // 2. Check if invoice already exists with a PDF URL using companyId context
        const existingInvoice = await (prisma as any).invoice.findFirst({
            where: { orderId, companyId: order.companyId },
        });

        if (existingInvoice && existingInvoice.pdfUrl) {
            return existingInvoice;
        }

        let invoice = existingInvoice;

        if (!invoice) {
            // 3. Increment company invoice counter and get new number
            const updatedCompany = await (prisma.company as any).update({
                where: { id: order.companyId },
                data: {
                    invoiceCounter: {
                        increment: 1,
                    },
                },
            });

            const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(updatedCompany.invoiceCounter).padStart(6, "0")}`;

            const amountSubunits = order.amountInSubunits !== null && order.amountInSubunits !== undefined && order.amountInSubunits > 0n
                ? order.amountInSubunits 
                : BigInt(Math.round((order.amount || 0) * 100));

            // 4. Create invoice record (without PDF URL yet)
            invoice = await (prisma as any).invoice.create({
                data: {
                    companyId: order.companyId,
                    orderId: order.id,
                    invoiceNumber,
                    subtotal: order.amount,
                    subtotalInSubunits: amountSubunits,
                    total: order.amount,
                    totalInSubunits: amountSubunits,
                    paymentStatus: "PAID",
                    paymentRef: paymentRef || null,
                },
            });
        }

        // 5. Generate PDF
        try {
            const pdfBuffer = await this.generateInvoicePDF(order, invoice);

            // 6. Upload to Supabase Storage if configured
            if (this.supabase) {
                // Ensure the 'invoices' bucket exists programmatically
                try {
                    const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
                    if (!listError && buckets) {
                        const bucketExists = buckets.some((b: any) => b.name === "invoices");
                        if (!bucketExists) {
                            console.log("🚀 Creating Supabase Storage bucket 'invoices'...");
                            const { error: createError } = await this.supabase.storage.createBucket("invoices", {
                                public: true
                            });
                            if (createError) {
                                console.error("❌ Supabase Create Bucket Error:", createError);
                            }
                        }
                    }
                } catch (bucketCheckErr) {
                    console.error("⚠️ Failed to check or create Supabase bucket 'invoices':", bucketCheckErr);
                }

                const filePath = `invoices/${order.companyId}/${order.id}_${invoice.invoiceNumber}.pdf`;
                const { data, error } = await this.supabase.storage
                    .from("invoices")
                    .upload(filePath, pdfBuffer, {
                        contentType: "application/pdf",
                        upsert: true,
                    });

                if (error) {
                    console.error("❌ Supabase Upload Error:", error);
                    throw error;
                }

                // Get public URL
                const { data: { publicUrl } } = this.supabase.storage
                    .from("invoices")
                    .getPublicUrl(filePath);

                // Update invoice with PDF URL
                return await (prisma as any).invoice.update({
                    where: { id: invoice.id },
                    data: { pdfUrl: publicUrl },
                });
            } else {
                throw new Error("Supabase client is not initialized / configured");
            }
        } catch (error) {
            console.error("❌ PDF Generation or Upload Error:", error);
            throw error; // Fail loudly so the job can be retried
        }
    }

    private async generateInvoicePDF(order: any, invoice: any): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 50 });
            const buffers: any[] = [];

            doc.on("data", buffers.push.bind(buffers));
            doc.on("end", () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            doc.on("error", reject);

            // --- PDF Content ---
            const { company } = order;

            // Header: Shop Details
            doc
                .fillColor("#444444")
                .fontSize(20)
                .text(company.businessName || company.name, 50, 50)
                .fontSize(10)
                .text(company.businessAddress || "", 50, 80)
                .text(`GSTIN: ${company.gstin || "N/A"}`, 50, 95)
                .moveDown();

            // Invoice Info
            doc
                .fillColor("#000000")
                .fontSize(20)
                .text("INVOICE", 50, 160, { align: "right" });

            doc
                .fontSize(10)
                .text(`Invoice No: ${invoice.invoiceNumber}`, 50, 185, { align: "right" })
                .text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString()}`, 50, 200, { align: "right" })
                .text(`Order ID: #${order.id.slice(0, 8)}`, 50, 215, { align: "right" })
                .moveDown();

            // Customer Details
            doc
                .fontSize(12)
                .text("Bill To:", 50, 250)
                .fontSize(10)
                .text(order.lead.name || "Customer", 50, 265)
                .text(order.lead.contact, 50, 278)
                .moveDown();

            // Table Header
            const tableTop = 330;
            doc.font("Helvetica-Bold");
            this.generateTableRow(doc, tableTop, "Item Description", "Qty", "Rate", "Total");
            this.generateHr(doc, tableTop + 20);
            doc.font("Helvetica");

            // Items (If order.items is available)
            let currentY = tableTop + 30;
            const items = Array.isArray(order.items) ? order.items : [{ name: order.summary, quantity: 1, price: order.amount }];

            for (const item of items) {
                const itemTotal = (item.price * item.quantity).toFixed(2);
                this.generateTableRow(
                    doc,
                    currentY,
                    item.name,
                    item.quantity.toString(),
                    item.price.toFixed(2),
                    itemTotal
                );
                currentY += 25;
            }

            this.generateHr(doc, currentY);

            // Totals
            const totalY = currentY + 20;
            this.generateInvoiceTotalRow(doc, totalY, order);

            // Footer
            doc
                .font("Helvetica")
                .fontSize(10)
                .text("Payment Status: PAID", 50, totalY + 40)
                .text(`Payment Ref: ${invoice.paymentRef || "N/A"}`, 50, totalY + 55)
                .text("Thank you for your business!", 50, totalY + 80, { align: "center", width: 500 });

            doc.end();
        });
    }

    /**
     * Compiles and prints the transactional currency totals row cleanly onto the PDF layout plane.
     * Removes static prefix strings in favor of contextually driven runtime labels.
     */
    public generateInvoiceTotalRow(doc: any, totalY: number, order: any): void {
        // Gracefully resolve the target ISO token directly from the database schema model
        const currencyLabel = (order.company?.currencyCode || "USD").toUpperCase();
        
        // Enforce precise decimal precision adjustments natively based on currency denomination types
        const isZeroDecimal = ["JPY", "KRW", "CLP"].includes(currencyLabel);

        const amountVal = order.amountInSubunits !== null && order.amountInSubunits !== undefined && order.amountInSubunits > 0n
            ? Number(order.amountInSubunits) / 100
            : order.amount;

        const formattedAmountString = isZeroDecimal 
            ? Math.round(amountVal).toString() 
            : amountVal.toFixed(2);

        this.generateTableRow(
            doc,
            totalY,
            "",
            "",
            "Total",
            `${currencyLabel} ${formattedAmountString}`
        );
    }

    private generateTableRow(doc: any, y: number, item: string, qty: string, rate: string, total: string) {
        doc
            .fontSize(10)
            .text(item, 50, y)
            .text(qty, 280, y, { width: 90, align: "right" })
            .text(rate, 370, y, { width: 90, align: "right" })
            .text(total, 0, y, { align: "right" });
    }

    private generateHr(doc: any, y: number) {
        doc
            .strokeColor("#aaaaaa")
            .lineWidth(1)
            .moveTo(50, y)
            .lineTo(550, y)
            .stroke();
    }
}

export const invoiceService = new InvoiceService();
