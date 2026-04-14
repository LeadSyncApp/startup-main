import { prisma } from "../lib/prisma";
import { OrderPriority } from "@prisma/client";

export async function createOrder(
  companyId: string,
  conversationId: string,
  leadId: string,
  summary: string
) {
  return prisma.order.create({
    data: {
      companyId,
      conversationId,
      leadId,
      summary,
      priority: OrderPriority.NORMAL,
    },
  });
}
