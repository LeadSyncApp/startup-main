import { prisma } from "../lib/prisma";
import { safeEmitConversationUpdate, emitToAgent, emitToCompany } from "../lib/socket";
import { notificationService } from "./notification.service";

export class AssignmentService {
    /**
     * Auto assignee logic based on the company's setting config.
     */
    async autoAssignConversation(companyId: string, conversationId: string) {
        try {
            console.log(`[ASSIGNMENT] Checking auto-assignment for conversation ${conversationId} in company ${companyId}`);
            
            // 1. Fetch Company Strategy
            const company = await prisma.company.findUnique({
                where: { id: companyId },
                select: { assignmentStrategy: true }
            });
            
            let strategy = company?.assignmentStrategy || "MANUAL";
            if (strategy === "MANUAL") {
                console.log(`[ASSIGNMENT] Company strategy is MANUAL (Manual Claims mode). Skipping auto-assignment.`);
                return null;
            }

            // 2. Find eligible, active users (agents, admins, or owners who are active and available to take chats)
            const activeAgents = await prisma.user.findMany({
                where: {
                    companyId,
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
                const lastAssignedConversation = await prisma.conversation.findFirst({
                    where: {
                        companyId,
                        assignedToId: { not: null },
                        id: { not: conversationId }
                    },
                    orderBy: { updatedAt: "desc" },
                    select: { assignedToId: true }
                });

                if (lastAssignedConversation && lastAssignedConversation.assignedToId) {
                    const lastAgentId = lastAssignedConversation.assignedToId;
                    const lastAgentIdx = activeAgents.findIndex(a => a.id === lastAgentId);
                    
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
                    activeAgents.map(async (agent) => {
                        const count = await prisma.conversation.count({
                            where: {
                                companyId,
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
                // 3. Make assignment update in Prisma
                const updatedConversation = await prisma.conversation.update({
                    where: { id: conversationId },
                    data: { assignedToId: chosenAgentId },
                    include: { 
                        assignedTo: { select: { id: true, name: true } },
                        lead: { select: { id: true, name: true, contact: true, channel: true, pendingOrderState: true } }
                    }
                }) as any;

                // Sync the pending order claimed status if one exists
                if (updatedConversation.lead?.pendingOrderState === "PENDING_APPROVAL") {
                    await prisma.lead.update({
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
                        agentAssigned: updatedConversation.assignedTo?.name || "Agent"
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
                const agent = activeAgents.find(a => a.id === chosenAgentId);
                const agentName = agent?.name || "Agent";
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
