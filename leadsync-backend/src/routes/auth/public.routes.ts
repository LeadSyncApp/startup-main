import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { Channel, MessageSender } from '@prisma/client'
import { queueProvider } from '../../services/infrastructure/queue-provider/queue-provider.factory'
import { autoReplyService } from '../../services/automation/autoReply.service'
import { triggerLeadWelcome } from '../../services/automation/autoReplyEventListeners'
import { PDF_JOB_NAME } from '../../services/infrastructure/pgboss/jobs/pdf.job'

const router = Router()

/**
 * POST /api/public/leads
 * Public endpoint – used by Home page
 */
router.post('/leads', async (req, res) => {
  try {
    const { name, contact } = req.body

    if (!contact) {
      return res.status(400).json({ message: 'Contact is required' })
    }

    // ✅ OPTION B: single default company
    const company = await prisma.company.findFirst({
      orderBy: { createdAt: 'asc' },
    })

    if (!company) {
      return res.status(500).json({ message: 'No company configured' })
    }

    const lead = await prisma.lead.upsert({
      where: {
        contact_channel_companyId: {
          contact,
          channel: Channel.WEBSITE,
          companyId: company.id,
        },
      },
      update: {},
      create: {
        name,
        contact,
        channel: Channel.WEBSITE,
        companyId: company.id,
        conversations: {
          create: {
            channel: Channel.WEBSITE,
            companyId: company.id, // ✅ REQUIRED
          },
        },
      },
      include: {
        conversations: true,
      },
    })

    // Seed default auto-reply rules for this company (idempotent)
    const companyName = await prisma.company.findUnique({ where: { id: company.id }, select: { name: true } });
    await autoReplyService.seedDefaults(company.id, companyName?.name || "our store");

    // Trigger welcome auto-reply for this new lead
    await triggerLeadWelcome(lead.id, company.id);

    res.json({ success: true, leadId: lead.id })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to create lead' })
  }
})


/**
 * GET /api/public/orders/:id
 * Public endpoint – Order Tracking
 */
router.get('/orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        summary: true,
        amount: true,
        createdAt: true,
        updatedAt: true,
        lead: {
          select: {
            name: true
          }
        },
        company: {
          select: {
            currencySymbol: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    console.error("Tracking error:", err);
    res.status(500).json({ message: 'Failed to fetch order' });
  }
});


/**
 * GET /api/public/mock-payment/:id
 * Simulation endpoint for testing billing without Razorpay
 */
router.get('/mock-payment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { orderWorkflowService } = require("../../services/workflow/orderWorkflow.service");
    // Queue PDF generation
    // MessageSender enum removed from schema
    const { emitToConversation } = require("../../lib/socket");
    const order = await prisma.order.findUnique({
      where: { id },
      include: { lead: true }
    });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    const { resolveTenantContext, tenantContextStorage } = require("../../services/context/tenantContext.provider");
    const tenantContext = await resolveTenantContext(order.companyId);

    await tenantContextStorage.run(tenantContext, async () => {
      // 1. Mark as PAID
      await orderWorkflowService.transitionStatus(
        order.companyId,
        id,
        "PAID" as any,
        { id: "SYSTEM", name: "Mock Payment Simulator", role: "SYSTEM" }
      );

      // 2. Generate Invoice asynchronously
      await queueProvider.enqueue(PDF_JOB_NAME, { orderId: id, paymentRef: "MOCK_PAY_" + Date.now() });

      // 3. Update Lead Stats
      const { recalculateLeadCRM } = require("../../services/integrations/crm.service");
      if (order.leadId) {
        await recalculateLeadCRM(order.leadId, order.companyId);
      }

      // 4. Confirmation Message
      let content = "✅ [MOCK] Payment Received successfully! Your order is now being processed. An invoice will be generated shortly.";

      // Find conversation via lead (Order no longer has direct conversation relation)
      const conv = order.leadId ? await prisma.conversation.findFirst({
        where: { leadId: order.leadId, lifecycleStatus: 'active', companyId: order.companyId }
      }) : null;
      const conversationId = conv?.id;

      const sysMsg = conversationId ? await prisma.message.create({
        data: {
          content: content,
          sender: MessageSender.SYSTEM,
          conversationId,
          companyId: order.companyId
        }
      }) : null;

      if (sysMsg && conversationId) {
        emitToConversation(conversationId, "new_message", sysMsg);
      }
    });

    res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #4CAF50;">✅ Mock Payment Successful!</h1>
                <p>Order ID: ${id}</p>
                <p>Status updated to <b>PAID</b></p>
                <p>Invoice will be generated shortly and sent to chat. You can close this window now.</p>
            </div>
        `);
  } catch (err: any) {
    console.error("Mock payment error:", err);
    res.status(500).send("Mock payment failed: " + err.message);
  }
});

export default router

