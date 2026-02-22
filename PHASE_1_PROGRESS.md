# Phase 1: Grounded Multi-Tenant AI Bot - Implementation Progress

## 🎯 Objective
Stabilize the AI ordering system by implementing strict grounding, session memory, and advanced merchant tuning, ensuring the bot never "hallucinates" and follows shop-specific rules.

---

## ✅ Completed Features

### 1. Robust AI Pipeline (Groq-Powered)
- **Primary Model**: `llama-3.3-70b-versatile` for high-intelligence reasoning and multi-lingual support.
- **Fallback Model**: `llama-3.1-8b-instant` for extreme speed and high-traffic stability.
- **Safety Layer**: Implemented a "Safe JSON Guard" to prevent raw AI internal JSON from ever leaking to the customer.
- **Service Refactor**: Renamed `geminiService` to `ai.service` to reflect the strictly Groq-based architecture (no Gemini required).

### 2. Multi-Tenant Grounding (The "Truth" Layer)
- **Menu Retrieval**: Standardized a `calculateRetrieval` engine that scans the merchant's menu before calling the AI, ensuring only real items and prices are discussed.
- **Knowledge Base**: Created a "Learned Context" system where merchants can provide raw shop notes. The AI distills these into a searchable fact sheet.
- **Shop Policies**: Added a dedicated database field and UI for `botPolicies` (Delivery, Returns, Store Rules). The AI is strictly grounded to these rules.

### 3. Session & Context Management
- **Smart Memory**: The bot now remembers the `last_category` and `preferences` (size, color, budget) within a chat session.
- **Follow-up Handling**: "How much for the red one?" now correctly maps to the previously discussed item.
- **Mirrored Language**: Enhanced prompts ensure the bot replies in the matching language (Tamil/Hindi/English) of the customer.

### 4. Admin Dashboard Enhancements
- **Advanced Tuning UI**: Added two-box system for Raw Knowledge and Learned Facts.
- **Policies Editor**: New UI section for managing grounded store rules.
- **Intent Badges**: The Conversations list now displays real-time AI intent detection (e.g., `PRICE QUERY`, `ORDER INTENT`) for better visibility.

---

## 🏗️ Technical Architecture Changes

| Component | Change |
| :--- | :--- |
| **Database** | Added `botPolicies` and `botLearnedContext` to the `Company` model. |
| **Backend** | Created `shop-ai.utils.ts` for retrieval and sanitization. |
| **Logic** | Updated `bot.logic.ts` to orchestrate the retrieval -> AI -> session pipeline. |
| **UI** | Updated `Settings.tsx` and `Conversations.tsx` for merchant control. |

---

## 🚀 Next Steps (Phase 2 Preview)
- **Structured Ordering Logic**: Move from "Ghost Orders" to full cart management.
- **Payment Link Integration**: Triggering checkouts directly via AI.
- **Advanced Role Management**: Better switching between AI and Human agents for complex escalations.

---
**Status: Phase 1 Complete & Verified.**
