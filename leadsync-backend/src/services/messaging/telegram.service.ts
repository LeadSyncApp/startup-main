import { prisma } from "../../lib/prisma";
import { OrderPriority } from "@prisma/client";

export async function createOrder(
  companyId: string,
  conversationId: string,
  leadId: string,
  summary: string,
  amount: number = 0
) {
  return prisma.order.create({
    data: {
      companyId,
      conversationId,
      leadId,
      summary,
      amount,
      amountInSubunits: BigInt(Math.round(amount * 100)),
      priority: OrderPriority.NORMAL,
    },
  });
}
