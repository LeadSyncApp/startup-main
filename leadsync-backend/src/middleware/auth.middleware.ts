import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'

export interface JwtUser {
  userId: string
  companyId: string
  role: 'OWNER' | 'AGENT'
}

export interface AuthRequest extends Request {
  user?: JwtUser
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers.authorization

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = header.split(' ')[1]

  try {
    const decoded = verifyToken(token) as JwtUser
    req.user = decoded
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid token' })
  }
}
