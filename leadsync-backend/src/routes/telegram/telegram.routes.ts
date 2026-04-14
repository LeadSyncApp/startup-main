import { Router } from 'express'
import { telegramWebhook } from './telegram.controller'

const router = Router()

router.post('/webhook', telegramWebhook)

export default router
