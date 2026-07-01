import { prisma } from "../../lib/prisma";
import { eventBus, Events } from "../infrastructure/eventBus";
import { getTenantContext } from "../context/tenantContext.provider";

export class BillingService {
    constructor() {
        // Subscribe to events
        eventBus.on(Events.ORDER_CREATED, this.handleOrderCreated.bind(this));
        console.log("💳 [BillingMicroservice] Initialized and listening for events.");
    }

    async handleOrderCreated(orderId: string, companyId: string) {
        console.log(`💳 [BillingMicroservice] Received ORDER_CREATED event for Order ${orderId}`);
        try {
            const context = getTenantContext();
            
            if (!context.currencySymbol || !context.currencyCode) {
                throw new Error(`SystemConfigurationException: Invoice engine failed to initialize. Tenant ${context.companyId} lacks valid currency properties.`);
            }

            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { orderItems: true }
            });

            if (!order) return;

            // Compute subtotal from normalized order items instead of taking the raw 'amount'
            let computedTotal = 0;
            if (order.orderItems && order.orderItems.length > 0) {
                computedTotal = order.orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            } else {
                computedTotal = order.amount;
            }

            if (computedTotal <= 0) return; // No billing needed for 0 amount

            const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${orderId.slice(0, 4).toUpperCase()}`;

            // Create immutable Invoice record directly tied to the new order
            const invoice = await prisma.invoice.create({
                data: {
                    companyId,
                    orderId,
                    invoiceNumber,
                    currency: context.currencyCode,
                    subtotal: computedTotal,
                    tax: 0, // Add tax logic later if needed
                    total: computedTotal,
                    paymentStatus: "PENDING"
                }
            });

            console.log(`💳 [BillingMicroservice] Created Invoice ${invoiceNumber} for Order ${orderId} with Amount ${context.currencySymbol}${computedTotal.toFixed(2)} (${context.currencyCode})`);
        } catch (error) {
            console.error(`💳 [BillingMicroservice] Error handling ORDER_CREATED:`, error);
        }
    }
}

export const billingService = new BillingService();
