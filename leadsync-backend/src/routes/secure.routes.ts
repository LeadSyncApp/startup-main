import { Router } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware'

const router = Router()

router.get('/secure', authMiddleware, (req: AuthRequest, res) => {
  res.json({
    message: 'Access granted',
    user: req.user
  })
})

export default router

