import { prisma } from "../../lib/prisma";
import { getPaymentGateway } from "./payment/paymentGateway.factory";
import { DiscrepancyType, DiscrepancyStatus } from "@prisma/client";

export interface ReconciliationSummary {
    totalChecked: number;
    matchedCount: number;
    mismatchedCount: number;
    discrepanciesCreated: number;
    hoursBack: number;
    executedAt: Date;
}

export class ReconciliationService {
    /**
     * Executes the reconciliation process comparing external provider payments with internal DB records.
     */
    public async runReconciliation(hoursBack: number = 48, provider: string = "razorpay"): Promise<ReconciliationSummary> {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - hoursBack * 60 * 60 * 1000);

        console.log(`🔍 [ReconciliationService] Starting reconciliation run for last ${hoursBack} hours (${startDate.toISOString()} to ${endDate.toISOString()})`);

        const gateway = getPaymentGateway(provider);
        const settledPayments = await gateway.fetchSettledPayments(startDate, endDate);

        // Fetch internal attempts & intents within timeframe
        const internalAttempts = await prisma.paymentAttempt.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate }
            },
            include: { paymentIntent: true }
        });

        const internalSucceededIntents = await prisma.paymentIntent.findMany({
            where: {
                status: "SUCCEEDED",
                updatedAt: { gte: startDate, lte: endDate }
            },
            include: { attempts: true }
        });

        let matchedCount = 0;
        let mismatchedCount = 0;
        let discrepanciesCreated = 0;

        const processedProviderTxIds = new Set<string>();

        // 1. Audit Provider Payments against Internal Records
        for (const provPayment of settledPayments) {
            processedProviderTxIds.add(provPayment.providerTransactionId);

            const matchingAttempt = internalAttempts.find(
                a => a.providerTransactionId === provPayment.providerTransactionId
            );

            if (!matchingAttempt) {
                // Payment exists at provider but not recorded internally
                mismatchedCount++;
                const created = await this.createDiscrepancyIfNotExists({
                    companyId: provPayment.companyId || null,
                    discrepancyType: DiscrepancyType.MISSING_INTERNAL_RECORD,
                    providerTransactionId: provPayment.providerTransactionId,
                    paymentIntentId: provPayment.paymentIntentId || null,
                    providerAmount: provPayment.amountInSubunits,
                    internalAmount: null,
                    details: {
                        message: "Payment captured at gateway but missing internal PaymentAttempt record",
                        providerPayment: provPayment
                    }
                });
                if (created) discrepanciesCreated++;
            } else {
                // Check Amount Match
                if (matchingAttempt.amountInSubunits !== provPayment.amountInSubunits) {
                    mismatchedCount++;
                    const created = await this.createDiscrepancyIfNotExists({
                        companyId: provPayment.companyId || matchingAttempt.paymentIntent?.companyId || null,
                        discrepancyType: DiscrepancyType.AMOUNT_MISMATCH,
                        providerTransactionId: provPayment.providerTransactionId,
                        paymentIntentId: matchingAttempt.paymentIntentId,
                        providerAmount: provPayment.amountInSubunits,
                        internalAmount: matchingAttempt.amountInSubunits,
                        details: {
                            message: `Amount mismatch: Provider (${provPayment.amountInSubunits}) vs Internal (${matchingAttempt.amountInSubunits})`,
                            providerPayment: provPayment,
                            matchingAttempt
                        }
                    });
                    if (created) discrepanciesCreated++;
                } else {
                    matchedCount++;
                }
            }
        }

        // 2. Audit Internal Succeeded Intents against Provider Records
        for (const intent of internalSucceededIntents) {
            const successfulAttempt = intent.attempts.find(a => a.status === "SUCCESS" && a.providerTransactionId);
            if (successfulAttempt && successfulAttempt.providerTransactionId) {
                if (!processedProviderTxIds.has(successfulAttempt.providerTransactionId)) {
                    // Internal intent marked SUCCEEDED but not returned in provider settled list
                    mismatchedCount++;
                    const created = await this.createDiscrepancyIfNotExists({
                        companyId: intent.companyId,
                        discrepancyType: DiscrepancyType.MISSING_PROVIDER_RECORD,
                        providerTransactionId: successfulAttempt.providerTransactionId,
                        paymentIntentId: intent.id,
                        providerAmount: null,
                        internalAmount: intent.amountInSubunits,
                        details: {
                            message: "Internal PaymentIntent marked SUCCEEDED but payment not present in provider settled payments",
                            intent
                        }
                    });
                    if (created) discrepanciesCreated++;
                }
            }
        }

        const summary: ReconciliationSummary = {
            totalChecked: settledPayments.length + internalSucceededIntents.length,
            matchedCount,
            mismatchedCount,
            discrepanciesCreated,
            hoursBack,
            executedAt: new Date()
        };

        console.log(`📊 [ReconciliationService] Summary: Total Checked: ${summary.totalChecked} | Matched: ${summary.matchedCount} | Mismatches: ${summary.mismatchedCount} | New Discrepancies Flagged: ${summary.discrepanciesCreated}`);

        return summary;
    }

    private async createDiscrepancyIfNotExists(params: {
        discrepancyType: DiscrepancyType;
        providerTransactionId: string | null;
        paymentIntentId: string | null;
        providerAmount: bigint | null;
        internalAmount: bigint | null;
        details: any;
        companyId?: string | null;
    }): Promise<boolean> {
        const companyId = params.companyId || params.details?.intent?.companyId || params.details?.matchingAttempt?.paymentIntent?.companyId || null;

        const existing = await prisma.reconciliationDiscrepancy.findFirst({
            where: {
                ...(companyId ? { companyId } : {}),
                discrepancyType: params.discrepancyType,
                providerTransactionId: params.providerTransactionId,
                paymentIntentId: params.paymentIntentId,
                status: DiscrepancyStatus.OPEN
            }
        });

        if (existing) {
            return false;
        }

        await prisma.reconciliationDiscrepancy.create({
            data: {
                companyId,
                discrepancyType: params.discrepancyType,
                providerTransactionId: params.providerTransactionId,
                paymentIntentId: params.paymentIntentId,
                providerAmount: params.providerAmount,
                internalAmount: params.internalAmount,
                details: params.details,
                status: DiscrepancyStatus.OPEN
            }
        });

        return true;
    }
}

export const reconciliationService = new ReconciliationService();
