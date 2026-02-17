"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const telegram_controller_1 = require("./telegram.controller");
const router = (0, express_1.Router)();
router.post('/webhook', telegram_controller_1.telegramWebhook);
exports.default = router;
