import { prisma } from "./prisma";

export const createTenantRepository = (companyId: string, tx?: any) => {
  const db = tx || prisma;

  return {
    $transaction: async (fn: (txDb: any) => Promise<any>) => {
      if (tx) {
        return fn(createTenantRepository(companyId, tx));
      }
      return prisma.$transaction(async (newTx) => {
        const txDb = createTenantRepository(companyId, newTx);
        return fn(txDb);
      });
    },

    company: {
      findUnique: (args: any) =>
        db.company.findFirst({
          ...args,
          where: {
            ...args?.where,
            id: companyId,
          },
        }),
      findFirst: (args?: any) =>
        db.company.findFirst({
          ...args,
          where: {
            ...args?.where,
            id: companyId,
          },
        }),
    },

    user: {
      findMany: (args?: any) =>
        db.user.findMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findFirst: (args?: any) =>
        db.user.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findUnique: (args: any) =>
        db.user.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
    },

    lead: {
      findMany: (args?: any) =>
        db.lead.findMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findFirst: (args?: any) =>
        db.lead.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findUnique: (args: any) =>
        db.lead.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      create: (args: any) =>
        db.lead.create({
          ...args,
          data: {
            ...args.data,
            companyId,
          },
        }),
      update: async (args: any) => {
        const existing = await db.lead.findFirst({
          where: { id: args.where.id, companyId },
        });
        if (!existing) {
          throw new Error(`Lead not found in tenant ${companyId}`);
        }
        return db.lead.update({
          ...args,
          where: { id: existing.id },
        });
      },
    },

    conversation: {
      findMany: (args?: any) =>
        db.conversation.findMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findFirst: (args?: any) =>
        db.conversation.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findUnique: (args: any) =>
        db.conversation.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      count: (args?: any) =>
        db.conversation.count({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      update: async (args: any) => {
        const existing = await db.conversation.findFirst({
          where: { id: args.where.id, companyId },
        });
        if (!existing) {
          throw new Error(`Conversation not found in tenant ${companyId}`);
        }
        return db.conversation.update({
          ...args,
          where: { id: existing.id },
        });
      },
    },

    order: {
      findMany: (args?: any) =>
        db.order.findMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findFirst: (args?: any) =>
        db.order.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findUnique: (args: any) =>
        db.order.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      create: (args: any) =>
        db.order.create({
          ...args,
          data: {
            ...args.data,
            companyId,
          },
        }),
      update: async (args: any) => {
        const existing = await db.order.findFirst({
          where: { id: args.where.id, companyId },
        });
        if (!existing) {
          throw new Error(`Order not found in tenant ${companyId}`);
        }
        return db.order.update({
          ...args,
          where: { id: existing.id },
        });
      },
      updateMany: (args: any) =>
        db.order.updateMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
    },

    orderLog: {
      create: (args: any) =>
        db.orderLog.create({
          ...args,
          data: {
            ...args?.data,
            companyId,
          },
        }),
    },

    orderItem: {
      createMany: (args?: any) => db.orderItem.createMany(args),
    },

    account: {
      findMany: (args?: any) =>
        db.account.findMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findFirst: (args?: any) =>
        db.account.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findUnique: (args: any) =>
        db.account.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      create: (args: any) =>
        db.account.create({
          ...args,
          data: {
            ...args.data,
            companyId,
          },
        }),
      update: async (args: any) => {
        const existing = await db.account.findFirst({
          where: { id: args.where.id, companyId },
        });
        if (!existing) {
          throw new Error(`Account not found in tenant ${companyId}`);
        }
        return db.account.update({
          ...args,
          where: { id: existing.id },
        });
      },
    },

    deal: {
      findMany: (args?: any) =>
        db.deal.findMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findFirst: (args?: any) =>
        db.deal.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findUnique: (args: any) =>
        db.deal.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      create: (args: any) =>
        db.deal.create({
          ...args,
          data: {
            ...args.data,
            companyId,
          },
        }),
      update: async (args: any) => {
        const existing = await db.deal.findFirst({
          where: { id: args.where.id, companyId },
        });
        if (!existing) {
          throw new Error(`Deal not found in tenant ${companyId}`);
        }
        return db.deal.update({
          ...args,
          where: { id: existing.id },
        });
      },
    },

    task: {
      findMany: (args?: any) =>
        db.task.findMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findFirst: (args?: any) =>
        db.task.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findUnique: (args: any) =>
        db.task.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      create: (args: any) =>
        db.task.create({
          ...args,
          data: {
            ...args.data,
            companyId,
          },
        }),
      update: async (args: any) => {
        const existing = await db.task.findFirst({
          where: { id: args.where.id, companyId },
        });
        if (!existing) {
          throw new Error(`Task not found in tenant ${companyId}`);
        }
        return db.task.update({
          ...args,
          where: { id: existing.id },
        });
      },
    },

    tag: {
      findMany: (args?: any) =>
        db.tag.findMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      create: (args: any) =>
        db.tag.create({
          ...args,
          data: {
            ...args.data,
            companyId,
          },
        }),
    },

    pipeline: {
      findMany: (args?: any) =>
        db.pipeline.findMany({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findFirst: (args?: any) =>
        db.pipeline.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      findUnique: (args: any) =>
        db.pipeline.findFirst({
          ...args,
          where: {
            ...args?.where,
            companyId,
          },
        }),
      create: (args: any) =>
        db.pipeline.create({
          ...args,
          data: {
            ...args.data,
            companyId,
          },
        }),
    },
  };
};
