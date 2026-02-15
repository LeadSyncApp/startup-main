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

export default router
