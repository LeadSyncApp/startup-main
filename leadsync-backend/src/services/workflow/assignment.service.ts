// ═══════════════════════════════════════════════════════════════════
// DEPRECATED — 30 Jun 2026
// This service is DEAD IN PRODUCTION and will be deleted after a
// grace period.  Do NOT use it for new code.
//
// Why dead:
//   • It reads Company.assignmentStrategy — that column NEV ER existed
//     in the live PostgreSQL database (migration was never applied).
//   • Without that column the first branch always hits `strategy ===
//     "MANUAL"` and returns null, so no auto-assignment ever fires.
//   • The caller in newOrderArrival.service.ts has already been
//     removed (Step 1 of deprecation plan, committed 2026-06-30).
//   • The live auto-assignment logic lives in
//     src/services/assignment.service.ts which writes claimedById /
//     claimedByName / claimedAt via the least-loaded algorithm
//     triggered by ai.orchestrator.worker.ts on AI escalation.
//   • This file still references the legacy "assignedToId" column
//     which is a leftover DB column not represented in schema.prisma.
//
// Superseded by: src/services/assignment.service.ts
// ═══════════════════════════════════════════════════════════════════
import { createTenantRepository } from "../../lib/tenantDb";
import { safeEmitConversationUpdate, emitToAgent, emitToCompany } from "../../lib/socket";
import { notificationService } from "../infrastructure/notification.service";

export class AssignmentService {
    /**
     * Auto assignee logic based on the company's setting config.
     */
    async autoAssignConversation(companyId: string, conversationId: string) {
        try {
            console.log(`[ASSIGNMENT] Checking auto-assignment for conversation ${conversationId} in company ${companyId}`);
            
            const tenantDb = createTenantRepository(companyId);

            // 1. Fetch Company Strategy
            const company = await tenantDb.company.findUnique({
                select: { assignmentStrategy: true }
            });
            
            let strategy = company?.assignmentStrategy || "MANUAL";
            if (strategy === "MANUAL") {
                console.log(`[ASSIGNMENT] Company strategy is MANUAL (Manual Claims mode). Skipping auto-assignment.`);
                return null;
            }

            // 2. Find eligible, active users (agents, admins, or owners who are active and available to take chats)
            const activeAgents = await tenantDb.user.findMany({
                where: {
                    isActive: true,
                    isAvailable: true,
                    role: { in: ["AGENT", "ADMIN", "OWNER"] }
                },
                orderBy: { id: "asc" }
            });

            if (activeAgents.length === 0) {
                console.log(`[ASSIGNMENT] No active agents available in company ${companyId}`);
                return null;
            }

            let chosenAgentId: string | null = null;

            if (strategy === "ROUND_ROBIN") {
                // Determine last assigned agent in the company
                const lastAssignedConversation = await tenantDb.conversation.findFirst({
                    where: {
                        assignedToId: { not: null },
                        id: { not: conversationId }
                    },
                    orderBy: { updatedAt: "desc" },
                    select: { assignedToId: true }
                });

                if (lastAssignedConversation && lastAssignedConversation.assignedToId) {
                    const lastAgentId = lastAssignedConversation.assignedToId;
                    const lastAgentIdx = activeAgents.findIndex((a: any) => a.id === lastAgentId);
                    
                    if (lastAgentIdx !== -1) {
                        const nextAgentIdx = (lastAgentIdx + 1) % activeAgents.length;
                        chosenAgentId = activeAgents[nextAgentIdx].id;
                    } else {
                        chosenAgentId = activeAgents[0].id;
                    }
                } else {
                    chosenAgentId = activeAgents[0].id; // Assign first agent if no previous assignment found
                }
                console.log(`[ASSIGNMENT] Round-robin strategy chose agent: ${chosenAgentId}`);

            } else if (strategy === "LOAD_BALANCED") {
                // Strategy: Choose agent with lowest open assigned conversations
                // Query active counters for agent capacities
                const agentConversationsCounts = await Promise.all(
                    activeAgents.map(async (agent: any) => {
                        const count = await tenantDb.conversation.count({
                            where: {
                                assignedToId: agent.id,
                                status: "OPEN"
                            }
                        });
                        return { agentId: agent.id, count };
                    })
                );

                // Sort by count ascending, choose the one with least workload
                agentConversationsCounts.sort((a, b) => a.count - b.count);
                chosenAgentId = agentConversationsCounts[0].agentId;
                console.log(`[ASSIGNMENT] Load-balanced strategy chose agent: ${chosenAgentId} (open load: ${agentConversationsCounts[0].count})`);
            }

            if (chosenAgentId) {
                // 3. Make assignment update in tenantDb
                const updatedConversation = await tenantDb.conversation.update({
                    where: { id: conversationId },
                    data: { assignedToId: chosenAgentId },
                    include: { 
                        assignedTo: { select: { id: true, firstName: true, lastName: true } },
                        lead: { select: { id: true, name: true, contact: true, channel: true, pendingOrderState: true } }
                    }
                }) as any;

                // Sync the pending order claimed status if one exists
                if (updatedConversation.lead?.pendingOrderState === "PENDING_APPROVAL") {
                    await tenantDb.lead.update({
                        where: { id: updatedConversation.leadId },
                        data: {
                            pendingOrderState: "CLAIMED_FOR_APPROVAL",
                            pendingOrderClaimedById: chosenAgentId,
                            pendingOrderClaimedAt: new Date()
                        }
                    });

                    // Emit lead update to the whole company so row updates or changes disappear/re-appear instantly
                    emitToCompany(companyId, "lead_updated", {
                        leadId: updatedConversation.leadId,
                        companyId,
                        hasPendingOrderApproval: true,
                        pendingOrderState: "CLAIMED_FOR_APPROVAL",
                        pendingOrderClaimedById: chosenAgentId,
                        pendingOrderClaimedAt: new Date(),
                        agentAssigned: updatedConversation.assignedTo ? `${updatedConversation.assignedTo.firstName} ${updatedConversation.assignedTo.lastName || ""}`.trim() : "Agent"
                    });
                }

                // 4. Emit to user/agency UI
                emitToAgent(chosenAgentId, "conversation_added", updatedConversation);
                safeEmitConversationUpdate(updatedConversation, "conversation_updated", {
                    conversationId: updatedConversation.id,
                    mode: updatedConversation.mode,
                    intent: updatedConversation.intent,
                    lead: updatedConversation.lead,
                    updatedAt: updatedConversation.updatedAt,
                    lastMessage: updatedConversation.summary || "",
                    assignedTo: updatedConversation.assignedTo,
                    conversation: updatedConversation
                });

                // 5. Notify agent
                const agent = activeAgents.find((a: any) => a.id === chosenAgentId) as any;
                const agentName = agent ? `${agent.firstName} ${agent.lastName || ""}`.trim() : "Agent";
                await notificationService.notifyUser(
                    chosenAgentId,
                    "New Auto-Assigned Lead",
                    `You've been auto-assigned a new conversation with ${updatedConversation.lead?.name || "Customer"} (${strategy === "ROUND_ROBIN" ? "Round Robin" : "Load Balanced"})`,
                    "MESSAGE"
                );

                console.log(`[ASSIGNMENT] Auto-assigned conversation ${conversationId} to ${agentName} (${strategy})`);
                return chosenAgentId;
            }

            return null;
        } catch (error) {
            console.error("[ASSIGNMENT ERROR] failed to auto-assign:", error);
            return null;
        }
    }
}

export const assignmentService = new AssignmentService();
