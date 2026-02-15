import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { signToken } from '../utils/jwt'

const router = Router()

console.log('🔥 auth.routes.ts loaded')

/**
 * SIGNUP (OWNER)
 */
router.post('/signup', async (req, res) => {
  try {
    const { companyName, name, email, password } = req.body

    // ✅ FIX 1: do NOT require companyName
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing fields' })
    }

    // ✅ FIX 2: check email globally (first owner only)
    const existingUser = await prisma.user.findFirst({
      where: { email }
    })

    if (existingUser) {
      return res.status(409).json({ message: 'Email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const company = await prisma.company.create({
      data: {
        // ✅ auto-create company name if not provided
        name: companyName || `${name}'s Company`,
        users: {
          create: {
            name,
            email,
            role: 'OWNER',
            passwordHash
          }
        }
      },
      include: {
        users: true
      }
    })

    const owner = company.users[0]

    const token = signToken({
      userId: owner.id,
      companyId: company.id,
      role: owner.role
    })

    res.status(201).json({
      token,
      user: {
        id: owner.id,
        email: owner.email,
        name: owner.name,
        role: owner.role
      },
      company: {
        id: company.id,
        name: company.name
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Signup failed' })
  }
})

/**
 * LOGIN
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findFirst({
      where: { email },
      include: { company: true }
    })

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = signToken({
      userId: user.id,
      companyId: user.companyId,
      role: user.role
    })

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      company: {
        id: user.company.id,
        name: user.company.name
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Login failed' })
  }
})

export default router
