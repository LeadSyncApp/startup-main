import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'


const router = Router()

router.get('/secure', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({
    message: 'Access granted',
    user: req.user
  })
})

router.post('/heartbeat', authMiddleware, async (req: AuthRequest, res: Response) => {
  // Update lastSeenAt and mark as online on every heartbeat
  const userId = req.user?.userId;
  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date(), isOnline: true },
    }).catch(err => console.error("Heartbeat update failed:", err));
  }
  res.json({ status: 'active', timestamp: new Date().toISOString() })
})

export default router

