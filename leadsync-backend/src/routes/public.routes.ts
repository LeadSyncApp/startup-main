import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { Channel } from '@prisma/client'

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
    const { orderWorkflowService } = await import("../services/orderWorkflow.service.js");
    const { invoiceService } = await import("../services/invoice.service.js");
    const { MessageSender } = await import("@prisma/client");
    const { emitToConversation } = await import("../lib/socket.js");

    const order = await prisma.order.findUnique({
      where: { id },
      include: { conversation: true, lead: true }
    });

    if (!order) {
      return res.status(404).send("Order not found");
    }

    // 1. Mark as PAID
    await orderWorkflowService.transitionStatus(
      id,
      "PAID" as any,
      { id: "SYSTEM", name: "Mock Payment Simulator", role: "SYSTEM" }
    );

    // 2. Generate Invoice
    const invoice = await invoiceService.ensureInvoiceForPaidOrder(id, "MOCK_PAY_" + Date.now());

    // 3. Update Lead Stats
    const { recalculateLeadCRM } = await import("../services/crm.service.js");
    await recalculateLeadCRM(order.leadId, order.companyId);

    // 4. Confirmation Message
    let content = "✅ [MOCK] Payment Received successfully! Your order is now being processed.";
    if (invoice.pdfUrl) {
      content += `\n\n📄 View your invoice: ${invoice.pdfUrl}`;
    }

    const sysMsg = await prisma.message.create({
      data: {
        content,
        sender: MessageSender.SYSTEM,
        conversationId: order.conversationId
      }
    });

    emitToConversation(order.conversationId, "new_message", sysMsg);

    res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #4CAF50;">✅ Mock Payment Successful!</h1>
                <p>Order ID: ${id}</p>
                <p>Status updated to <b>PAID</b></p>
                <p>Invoice generated and sent to chat. You can close this window now.</p>
                <a href="${invoice.pdfUrl}" target="_blank" style="padding: 10px 20px; background: #2196F3; color: white; text-decoration: none; border-radius: 5px;">View Invoice PDF</a>
            </div>
        `);
  } catch (err: any) {
    console.error("Mock payment error:", err);
    res.status(500).send("Mock payment failed: " + err.message);
  }
});

export default router

