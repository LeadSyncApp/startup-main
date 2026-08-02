import { prisma } from "../../src/lib/prisma";
import crypto from "crypto";
import { getPaymentGateway, paymentGatewayFactory } from "../../src/services/integrations/payment/paymentGateway.factory";
import { IPaymentGateway, SettledPaymentRecord } from "../../src/services/integrations/payment/paymentGateway.interface";
import { paymentEngineService } from "../../src/services/integrations/paymentEngine.service";
import { outboxWorker } from "../../src/services/infrastructure/outbox.worker";
import { reconciliationService } from "../../src/services/integrations/reconciliation.service";
import { OrderStatus, PaymentIntentStatus, DiscrepancyType } from "@prisma/client";

// Mock Payment Gateway for Integration Testing
class TestMockGateway implements IPaymentGateway {
    public mockSettledPayments: SettledPaymentRecord[] = [];

    public async createPaymentLink(params: any): Promise<any> {
        const id = "plink_test_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        return {
            providerPaymentLinkId: id,
            shortUrl: `https://pay.test/${id}`
        };
    }

    public verifyWebhookSignature(rawBody: string | Buffer, signature: string, secret: string): boolean {
        if (!rawBody || !signature || !secret) return false;
        const rawBodyString = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody);
        const expectedSignature = crypto.createHmac("sha256", secret).update(rawBodyString).digest("hex");
        return signature === expectedSignature;
    }

    public async createRefund(params: any): Promise<any> {
        return {
            providerRefundId: "rfnd_test_" + Date.now(),
            status: "processed"
        };
    }

    public async getPaymentStatus(providerTransactionId: string): Promise<any> {
        return {
            id: providerTransactionId,
            amountInSubunits: 50000n,
            currency: "INR",
            status: "captured"
        };
    }

    public async fetchSettledPayments(startDate: Date, endDate: Date): Promise<SettledPaymentRecord[]> {
        return this.mockSettledPayments;
    }
}

async function runTestSuite() {
    console.log("=================================================");
    console.log("🧪 RUNNING PHASE 3 PAYMENT INTEGRATION TEST SUITE");
    console.log("=================================================\n");

    const mockGateway = new TestMockGateway();
    paymentGatewayFactory.setOverrideGateway(mockGateway);

    let passedCount = 0;
    let failedCount = 0;

    async function assertTest(name: string, fn: () => Promise<void>) {
        try {
            await fn();
            console.log(`✅ [PASS] ${name}`);
            passedCount++;
        } catch (err: any) {
            console.error(`❌ [FAIL] ${name}:`, err.message || err);
            failedCount++;
        }
    }

    // Seed Test Company & Lead
    const company = await prisma.company.create({
        data: {
            name: "Phase3 Test Company " + Date.now(),
            companyCode: "P3TEST_" + Date.now()
        }
    });

    const lead = await prisma.lead.create({
        data: {
            companyId: company.id,
            contact: "+9199999" + Math.floor(10000 + Math.random() * 90000),
            channel: "WEBSITE"
        }
    });

    const conversation = await prisma.conversation.create({
        data: {
            companyId: company.id,
            leadId: lead.id,
            channel: "WEBSITE"
        }
    });

    const secret = "test_webhook_secret_12345";
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;

    // 1️⃣ Test Signature Verification Logic
    await assertTest("1. Signature Verification & Rejection", async () => {
        const rawBody = JSON.stringify({ event: "payment_link.paid" });
        const validSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
        const invalidSig = "invalid_signature_hash_xyz";

        const gateway = getPaymentGateway();
        const validCheck = gateway.verifyWebhookSignature(rawBody, validSig, secret);
        const invalidCheck = gateway.verifyWebhookSignature(rawBody, invalidSig, secret);

        if (!validCheck) throw new Error("Valid signature was rejected");
        if (invalidCheck) throw new Error("Invalid signature was accepted");
    });

    // 2️⃣ Test Valid Webhook Processing & Transactional Outbox
    let createdOrderId = "";
    await assertTest("2. Valid Webhook Processing & Transactional Outbox", async () => {
        const order = await prisma.order.create({
            data: {
                companyId: company.id,
                conversationId: conversation.id,
                leadId: lead.id,
                summary: "Phase 3 Test Order",
                amountInSubunits: 100000n,
                status: OrderStatus.BOT_CREATED_ORDER
            }
        });
        createdOrderId = order.id;

        const payload = {
            event: "payment_link.paid",
            payload: {
                payment_link: {
                    entity: {
                        id: "plink_test_" + Date.now(),
                        payment_id: "pay_test_" + Date.now(),
                        amount: 100000,
                        notes: {
                            order_id: order.id,
                            company_id: company.id
                        }
                    }
                }
            }
        };

        const rawBody = JSON.stringify(payload);
        const eventHash = crypto.createHash("sha256").update(rawBody).digest("hex");

        // Execute Webhook Logic directly inside transaction
        await prisma.$transaction(async (tx) => {
            await tx.processedWebhookEvent.create({
                data: { id: eventHash, provider: "razorpay", eventType: payload.event }
            });

            await tx.order.update({
                where: { id: order.id },
                data: { status: OrderStatus.PAID }
            });

            await tx.outboxEvent.create({
                data: {
                    companyId: company.id,
                    aggregateType: "ORDER",
                    aggregateId: order.id,
                    eventType: "PAYMENT_SUCCEEDED",
                    payload: { orderId: order.id, companyId: company.id, amount: 1000 }
                }
            });
        });

        // Verify Order is PAID
        const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
        if (updatedOrder?.status !== OrderStatus.PAID) {
            throw new Error(`Expected order status PAID, got ${updatedOrder?.status}`);
        }

        // Verify Outbox Event created
        const outboxEvent = await prisma.outboxEvent.findFirst({
            where: { companyId: company.id, aggregateId: order.id, eventType: "PAYMENT_SUCCEEDED" }
        });
        if (!outboxEvent) throw new Error("Outbox event was not created in transaction");
        if (outboxEvent.status !== "PENDING") throw new Error(`Expected outbox status PENDING, got ${outboxEvent.status}`);

        // Process Outbox events asynchronously
        const processed = await outboxWorker.processPendingEvents();
        if (processed === 0) throw new Error("Outbox worker did not process pending events");

        const processedEvent = await prisma.outboxEvent.findUnique({ where: { id: outboxEvent.id } });
        if (processedEvent?.status !== "PROCESSED") throw new Error(`Expected outbox status PROCESSED, got ${processedEvent?.status}`);
    });

    // 3️⃣ Test Duplicate Webhook Rejection
    await assertTest("3. Duplicate Webhook Deduplication", async () => {
        const payloadHash = "duplicate_hash_test_" + Date.now();

        await prisma.processedWebhookEvent.create({
            data: { id: payloadHash, provider: "razorpay", eventType: "payment_link.paid" }
        });

        // Attempt second insert with same hash
        let duplicateCaught = false;
        try {
            await prisma.processedWebhookEvent.create({
                data: { id: payloadHash, provider: "razorpay", eventType: "payment_link.paid" }
            });
        } catch (err: any) {
            if (err.code === "P2002" || err.message?.includes("Unique constraint")) {
                duplicateCaught = true;
            }
        }

        if (!duplicateCaught) throw new Error("Duplicate webhook event was not rejected");
    });

    // 4️⃣ Test Partial and Full Refund Flows
    await assertTest("4. Partial & Full Refund Flows", async () => {
        const intent = await paymentEngineService.createPaymentIntent({
            companyId: company.id,
            amountInSubunits: 200000n, // ₹2000.00
            currency: "INR"
        });

        // Set status to SUCCEEDED and create successful attempt
        await prisma.paymentIntent.update({
            where: { id: intent.id },
            data: { status: PaymentIntentStatus.SUCCEEDED }
        });

        await prisma.paymentAttempt.create({
            data: {
                paymentIntentId: intent.id,
                amountInSubunits: 200000n,
                status: "SUCCESS",
                providerTransactionId: "pay_test_refund_" + Date.now()
            }
        });

        // Partial Refund: ₹500 (50000 subunits)
        const partialRes = await paymentEngineService.processRefund({
            companyId: company.id,
            paymentIntentId: intent.id,
            amountInSubunits: 50000n,
            reason: "Partial refund test"
        });

        if (partialRes.paymentIntent.status !== PaymentIntentStatus.PARTIALLY_REFUNDED) {
            throw new Error(`Expected status PARTIALLY_REFUNDED, got ${partialRes.paymentIntent.status}`);
        }

        // Complete remaining Refund: ₹1500 (150000 subunits)
        const fullRes = await paymentEngineService.processRefund({
            companyId: company.id,
            paymentIntentId: intent.id,
            amountInSubunits: 150000n,
            reason: "Final refund test"
        });

        if (fullRes.paymentIntent.status !== PaymentIntentStatus.REFUNDED) {
            throw new Error(`Expected status REFUNDED, got ${fullRes.paymentIntent.status}`);
        }

        // Verify Outbox events created for refunds
        const refundOutboxEvents = await prisma.outboxEvent.findMany({
            where: { companyId: company.id, aggregateId: intent.id }
        });
        if (refundOutboxEvents.length < 2) {
            throw new Error(`Expected 2 refund outbox events, found ${refundOutboxEvents.length}`);
        }
    });

    // 5️⃣ Test Reconciliation Discrepancy Detection
    await assertTest("5. Reconciliation Discrepancy Detection", async () => {
        // Setup mock gateway payments
        mockGateway.mockSettledPayments = [
            {
                providerTransactionId: "pay_unrecorded_gateway_123",
                amountInSubunits: 150000n,
                currency: "INR",
                status: "captured",
                createdAt: new Date(),
                paymentIntentId: null,
                companyId: company.id
            },
            {
                providerTransactionId: "pay_mismatch_amount_456",
                amountInSubunits: 250000n, // Gateway says ₹2500
                currency: "INR",
                status: "captured",
                createdAt: new Date(),
                companyId: company.id
            }
        ];

        // Create internal attempt with amount mismatch (₹2000 vs ₹2500)
        const intent = await prisma.paymentIntent.create({
            data: {
                companyId: company.id,
                amountInSubunits: 200000n,
                currency: "INR",
                status: PaymentIntentStatus.SUCCEEDED,
                idempotencyKey: "idem_recon_test_" + Date.now()
            }
        });

        await prisma.paymentAttempt.create({
            data: {
                paymentIntentId: intent.id,
                providerTransactionId: "pay_mismatch_amount_456",
                amountInSubunits: 200000n, // Internal says ₹2000
                status: "SUCCESS"
            }
        });

        const summary = await reconciliationService.runReconciliation(24);

        if (summary.mismatchedCount === 0) {
            throw new Error("Reconciliation failed to detect mismatches");
        }

        // Verify discrepancy records in DB
        const missingRecord = await prisma.reconciliationDiscrepancy.findFirst({
            where: { companyId: company.id, providerTransactionId: "pay_unrecorded_gateway_123", discrepancyType: DiscrepancyType.MISSING_INTERNAL_RECORD }
        });
        if (!missingRecord) throw new Error("MISSING_INTERNAL_RECORD discrepancy was not flagged in DB");

        const amountMismatchRecord = await prisma.reconciliationDiscrepancy.findFirst({
            where: { companyId: company.id, providerTransactionId: "pay_mismatch_amount_456", discrepancyType: DiscrepancyType.AMOUNT_MISMATCH }
        });
        if (!amountMismatchRecord) throw new Error("AMOUNT_MISMATCH discrepancy was not flagged in DB");
    });

    // Cleanup Test Data
    paymentGatewayFactory.setOverrideGateway(null);
    await prisma.company.delete({ where: { id: company.id } }).catch(() => {});

    console.log("\n=================================================");
    console.log(`📊 TEST SUITE COMPLETE: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log("=================================================\n");

    if (failedCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTestSuite().catch((err) => {
    console.error("❌ Test suite crashed:", err);
    process.exit(1);
});
