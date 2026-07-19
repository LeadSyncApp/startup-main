# Investigation Report — Event Auto-Replies vs AI Instructions

**Scope:** LeadSync SaaS (WhatsApp/Telegram/Instagram chat automation for shop owners)
**Date:** 2026-07-19
**Status:** Investigation only — no code changed.

---

## 0. Executive Summary (read this first)

There are **two independent automation subsystems** that both send bot messages into a customer conversation, and they barely know about each other:

| System | UI label | Backend model | Routes | Trigger |
|---|---|---|---|---|
| **Event Auto-Replies** | "⚡ Event Auto-Replies" | `AutoReplyRule` + `AutoReplyLog` | `/api/auto-reply/*` | Order/lead **events** (eventBus + worker jobs) |
| **AI Instructions** | "🧠 AI Instructions" | `ConversationalRule` + `RuleGroup` (+ `KnowledgeChunk`) | `/api/automation/conversational-rules/*`, `/api/automation/rule-groups/*` | **Inbound customer messages** (orchestrator message loop) |

The **critical finding**: these two systems overlap in two ways:

1. **Same conversation, two senders.** Event Auto-Replies fire on order-status/lead events and send a message *independent* of the message loop. AI Instructions run *inside* the message loop and can also send a message. Both gate on `Conversation.mode === "BOT"`, so they can both fire in the same thread for the same customer — potentially producing two bot messages (e.g. an order confirmation auto-reply AND an AI reply to the customer's message).

2. **"AI Instructions" text is duplicated and partly dead.** The free-form instruction text a shop owner types is stored in `ConversationalRule.sourcePrompt` — **which is never read anywhere in the backend**. Only the derived `templateBody` / `triggerKeywords` are used. Separately, AI Instructions are *also* injected as soft context into the main LLM reply (the `<ActiveConversationalRules>` block in `generateShopReply`), so they influence the AI *and* can fire as a hard canned reply. The real "system instruction" surface is actually `BotConfiguration.botPolicies` (Support/Policy RAG), not the AI Instructions UI at all.

See §4 for the full conflict list and §5 for restructuring options.

---

## 1. Frontend Map

**File:** `leadsync-frontend/src/features/configurations/AutoRepliesPage.tsx` (1876 lines)
**Mount:** `App.tsx:456-460` — rendered inside `MasterDashboardLayout` when `activeTab === 'automation'`. No dedicated URL; the `/` route guards only on `user` (redirect to `/onboarding`). No per-tab RBAC guard.

### 1.1 Component tree
Single component `AutoRepliesPage()` (`AutoRepliesPage.tsx:58`). Navigation is internal state, not routes:

```
AutoRepliesPage
├── useState: currentView: "ai-list" | "ai-detail" | "events-list" | "events-detail"
├── Left sidebar (L1451–1474)
│    ├── button → navigateTo("ai-list")         // 🧠 AI Instructions (purple theme)
│    └── button → navigateTo("events-list")     // ⚡ Event Auto-Replies (teal theme)
├── Main panel (L1476–1481) — renders ONE of:
│    ├── renderAiList()        (L532)  — AI Instruction flows (RuleGroups) + ungrouped instructions
│    ├── renderAiDetail()      (L698)  — instructions timeline + test box
│    ├── renderEventList()     (L1092) — Order Updates / Customer Messages cards
│    └── renderEventDetail()   (L1172) — event rules timeline
│         └── EventTimelinePair (L1619-1640, module-scope sub-component) — per-event toggle/edit/delete
└── Modals (L1483–1609): showCreateModal (create flow), showPreviewModal (preview generated AI instruction)
```

No router tabs, no nested routes. `activeFlow` ("order"|"lead") is a *visual* sub-filter inside Event detail only (L1278–1291).

### 1.2 State management
- **All `useState`, local to the component.** No Zustand store holds automation data (existing stores: `simulationStore`, `useActivityStore`, `useNotificationStore` — none imported here).
- **No TanStack Query / React Query.** Every fetch is a hand-rolled `async` + `authedFetch`/`client.ts` helper with manual `setState`/`try-catch`/`toast`. **No query keys exist.**
- Key local state: `rules` (auto-reply rules, L68), `instructions` (conversational rules, L63), `ruleGroups` (L89), `previewMessages` (L75), `testStates` (L299), `editingRuleId` etc. (L94–100), `currentView` (L60), `activeFlow` (L69).

### 1.3 Data fetched per screen
**Event Auto-Replies** uses raw `authedFetch` (no `client.ts` wrapper):

| Action | Location | Method+Endpoint | Sends |
|---|---|---|---|
| Fetch rules | `fetchRules` L185 | GET `/api/auto-reply/rules` | — |
| Toggle | `toggleRule` L196 | PUT `/api/auto-reply/rules/:id` | `{ isEnabled: !rule.isEnabled }` |
| Delete | `deleteRule` L212 | DELETE `/api/auto-reply/rules/:id` | — |
| Inline save | `saveInlineEdit` L226 | PUT `/api/auto-reply/rules/:id` | `{ messageBody, delayMinutes, useAI, brandVoice, targetLanguage }` |
| Generate from desc | `generateQuickAutomation` L252 | POST `/api/auto-reply/generate-from-description` | `{ description, language:"auto" }` |

**AI Instructions** uses `client.ts` (`src/api/client.ts`):

| Action | client.ts fn | Method+Endpoint | Sends |
|---|---|---|---|
| List rules | `listSmartRules` L231 | GET `/api/automation/conversational-rules/:companyId?groupId=` | — |
| Generate from prompt | `generateSmartRules` L198 | POST `.../generate-from-prompt` | `{ prompt, companyId, groupId, businessName, businessType }` |
| Create rule | `createSmartRule` L216 | POST `.../conversational-rules` | `{ ...ruleFields, sourcePrompt }` |
| Update rule | `updateSmartRule` L243 | PUT `.../conversational-rules/:id` | `{ isEnabled: !current }` |
| Delete rule | `deleteSmartRule` L256 | DELETE `.../conversational-rules/:id` | — |
| List groups | `listRuleGroups` L101 | GET `.../rule-groups/:companyId?type=AI_INSTRUCTION` | — |
| Create group | `createRuleGroup` L86 | POST `.../rule-groups` | `{ companyId, name, type:"AI_INSTRUCTION" }` |
| Update group | `updateRuleGroup` L134 | PUT `.../rule-groups/:id` | `{ isEnabled: !current }` |
| Delete group | `deleteRuleGroup` L123 | DELETE `.../rule-groups/:id` | — |
| Test instruction | `testInstruction` L295 | POST `/api/auto-reply/test-instruction` | `{ instruction, testMessage }` |
| Generate example | `generateExample` L309 | POST `/api/auto-reply/generate-example` | `{ instruction }` |

> **Note — dead client code:** `testSmartRule` (L268 → `POST /api/automation/conversational-rules/test`) and `getSmartRuleLogs` (L282) exist in `client.ts` but are **never called** by `AutoRepliesPage`. The page reuses the Event Auto-Replies test endpoints (`/api/auto-reply/test-instruction`, `/generate-example`) for AI Instructions testing.

### 1.4 Hardcoded logic / "5/5 active"
The "X/Y active" counts are **computed entirely client-side** from the static constant arrays, NOT from the API:

```ts
// AutoRepliesPage.tsx:30-42
const EVENT_METADATA = { "order.placed": {...category:"order"}, ..., "lead.cold_recovery": {...category:"lead"} };
const FLOW_ORDER_EVENTS = ["order.placed","order.confirmed","order.preparing","order.ready","order.delivered"]; // 5
const FLOW_LEAD_EVENTS  = ["lead.welcome","lead.followup","lead.cold_recovery"]; // 3
```
```ts
// L381-386
const activeRulesCount = (flow) => (flow==="order"?FLOW_ORDER_EVENTS:FLOW_LEAD_EVENTS).filter(e=>getRule(e)?.isEnabled).length;
const totalRulesCount  = (flow) => (flow==="order"?FLOW_ORDER_EVENTS:FLOW_LEAD_EVENTS).length;
```

Rendered at L1283/L1289 (`🛍️ Order Updates (N/5)`), L1392 footer, L1118–1154 card counts. **The denominator is the hardcoded array length**, so the UI shows `/5` even if the backend returned fewer than 5 rules. Only the AI-Instruction *group* count (`group._count?.rules`, L581/L590) is server-derived.

### 1.5 How the UI distinguishes the two
Two sidebar buttons with different visual themes (purple = AI Instructions, teal = Event Auto-Replies) switching `currentView`. They are **conceptually separate products** glued into one screen: Event Auto-Replies = event-keyed toggle list; AI Instructions = free-text prompt → structured rule (flow/group) + test simulator.

---

## 2. Backend Map

### 2.1 Routes

**`/api/auto-reply/*` — Event Auto-Replies** (`routes/automation/autoReply.routes.ts`, mounted in `app.ts:141`)
All use `authMiddleware`; some require `automation.manage` permission.

| Method | Path | Purpose | Service/DB calls |
|---|---|---|---|
| GET | `/rules` | List rules; **auto-seeds** if empty | `autoReplyService.getRules` → `seedDefaults` if none |
| PUT | `/rules/batch-toggle` | Toggle many rules | `prisma.autoReplyRule.updateMany`; `getRules` |
| PUT | `/rules/:ruleId` | Update one rule | `autoReplyService.updateRule` |
| POST | `/seed` | Seed defaults | `autoReplyService.seedDefaults` |
| GET | `/logs` | Last 50 logs | `prisma.autoReplyLog.findMany` |
| POST | `/generate-from-description` | AI-generate message bodies from biz description | `aiPersonalityService.generateMessage`; `updateRule` (only overwrites enabled rules) |
| POST | `/test-instruction` | Free-form instruction → Groq reply | `getGroq().chat.completions.create` (no DB) |
| POST | `/generate-example` | Example conversation from instruction | `getGroq()` (no DB) |

**`/api/automation/conversational-rules/*` — AI Instructions** (`routes/automation/conversationalRules.routes.ts`)
| Method | Path | Purpose | Service/DB calls |
|---|---|---|---|
| POST | `/generate-from-prompt` | Preview rule from free prompt | `ruleGeneratorService.generateFromPrompt` |
| POST | `/` | Create rule | `prisma.conversationalRule.create` → `embedRuleToKnowledgeChunk` + `invalidateCache` |
| GET | `/:companyId` | List rules (`?groupId=`) | `findMany` w/ `_count.logs` |
| GET | `/detail/:id` | Rule + 50 logs | `findUnique` |
| PUT | `/:id` | Update rule (whitelisted fields incl. `sourcePrompt`) | `update` → `embedRuleToKnowledgeChunk` + `invalidateCache` |
| DELETE | `/:id` | Delete rule | `delete` + raw `DELETE FROM "KnowledgeChunk" WHERE sourceType='RULE' AND sourceId=:id` |
| POST | `/test` | Test rule | `conversationalAutoReplyService.testRule` |
| GET | `/logs/:companyId` | Rule logs + count | `findMany` + `count` |

**`/api/automation/rule-groups/*` — AI Instruction flows** (`routes/automation/ruleGroups.routes.ts`)
| Method | Path | Purpose | Service/DB |
|---|---|---|---|
| POST | `/` | Create group (`type` ∈ `AI_INSTRUCTION`\|`EVENT_FLOW`) | `prisma.ruleGroup.create` |
| GET | `/:companyId` | List groups (`?type=`) | `findMany` w/ `_count.rules` |
| GET | `/detail/:id` | Group + rules | `findUnique` |
| PUT | `/:id` | Update group / toggle | `update` + `invalidateCache` on `isEnabled` change |
| DELETE | `/:id` | Delete group + child rules | `deleteMany` rules then group |

### 2.2 Request lifecycle

**Event Auto-Reply — creating / editing / toggling / deleting**
- *Create:* never via UI — created by `seedDefaults(companyId)` (`autoReply.service.ts:131`) which `upsert`s all 8 `AUTO_REPLY_EVENTS` keys. Called from `GET /rules` (lazy), `POST /seed`, `POST /generate-from-description`, and `auth.routes.ts` on signup.
- *Edit:* `PUT /rules/:id` → `updateRule` (L160) updates `isEnabled / messageBody / delayMinutes / useAI / brandVoice / targetLanguage`.
- *Toggle:* `PUT /rules/:id` with `isEnabled`, or `PUT /rules/batch-toggle` (`updateMany`).
- *Delete:* `DELETE /rules/:id` (the route exists; note `AutoReplyRule` has no `deletedAt` — deletion is **hard**).
- *On event:* `eventBus` listeners (`autoReplyEventListeners.ts`) → `autoReplyService.processEvent(eventKey, context)`:
  - `ORDER_STATUS_CHANGED` → maps status→eventKey (`CONFIRMED→order.confirmed`, etc.; `NEW` excluded to avoid dup with `ORDER_CREATED`).
  - `ORDER_CREATED` → `order.placed` (only if status `NEW`/`BOT_CREATED_ORDER`).
  - `triggerLeadWelcome` → `lead.welcome`; `triggerLeadFollowUp` → `lead.followup`/`lead.cold_recovery`.
  - `processEvent` (L182): advisory-lock + recent-send check (2-min window) → if `delayMinutes>0` enqueue pg-boss job `DELAYED_AUTO_REPLY_JOB_NAME` → else reserve `AutoReplyLog` (PENDING) → `executeDelayedAutoReply` → fills template or calls `aiPersonalityService.generateMessage` if `useAI` → `outboundDispatcherService.dispatch`.

**AI Instruction — creating / editing / toggling / deleting**
- *Create:* `POST /` → `conversationalRule.create` + `embedRuleToKnowledgeChunk` (writes `KnowledgeChunk` `sourceType:'RULE'`, `sourceId:rule.id`) + `invalidateCache`.
- *Edit:* `PUT /:id` (whitelisted fields incl. `sourcePrompt` → L262).
- *Toggle:* `PUT /:id` `isEnabled`, or `PUT /rule-groups/:id` (group toggle cascades to rules via `getActiveRules` filter L520).
- *Delete:* `DELETE /:id` removes rule + its `KnowledgeChunk` (raw SQL).

### 2.3 Which system answers an inbound message? (the priority/conflict decision)

The decision lives in **`ai.orchestrator.worker.ts` → `processWebhookJob`** (runs for every inbound customer message, only when `Conversation.mode === "BOT"`):

1. **Phase 2a — Conversational (AI Instruction) rules first** (L275-318): `conversationalAutoReplyService.evaluateMessage(...)`:
   - Loads active rules (eligibility: enabled + not expired + group enabled).
   - RAG similarity match via `retrieveSimilarChunks(..., "RULE")`; confident if `gap >= 0.04` (or single-rule → never confident).
   - If confident & non-RAG rule → **sends the template/AI reply immediately and returns**; orchestrator then `return`s and **skips the main LLM** (L289-313). → AI Instruction *wins*, AI reply suppressed.
   - If not confident → logged `ai_fallback`, falls through.
2. **Phase 2b — Main AI reply** (L320+): `generateShopReply` with system prompt `compileDynamicOmniPrompt` + the `<ActiveConversationalRules>` block built from the *same* active rules (`rulesAsContext`, L269-273) injected as **soft context**. So AI Instructions influence the main AI reply *even when they didn't hard-match*.

**Event Auto-Replies never participate in the message loop** — they fire on order/lead *events* (eventBus, pg-boss jobs), fully outside `processWebhookJob`. The only shared gate is `Conversation.mode === "BOT"`.

**So the effective priority is:**
- Inbound *message*: ConversationalRule (confident match) → else main LLM (which still sees AI Instructions as context).
- Order/lead *event*: AutoReplyRule (independent), also gated on BOT mode.

### 2.4 Where both systems are read to build one reply
There is **no single point where an AutoReplyRule template and a ConversationalRule prompt are merged**. The only "merge into one prompt" is AI Instructions → main LLM via `generateShopReply`'s `<ActiveConversationalRules>` block (`ai.service.ts:436-438`), which summarizes active rules as text fed to the LLM. Event Auto-Replies are *not* injected into the LLM prompt at all. **`sourcePrompt` (the actual free-form instruction) is never read** — only `name`/`triggerKeywords`/`templateBody` (truncated to 120 chars, `ai.orchestrator.worker.ts:271`).

### 2.5 Shared services
- `aiPersonalityService` (`services/ai/aiPersonality.service.ts`): used by BOTH systems' `useAI` paths. Reads `BotConfiguration` (`ai_brand_voice`/`brandVoice`, `ai_target_language`/`targetLanguage`) from cache — **not** ConversationalRule text. For Event Auto-Replies it gets `originalTemplate` + `eventKey`; for AI Instructions it gets `originalTemplate` + a custom prompt.
- `outboundDispatcherService`: single send path for both.

---

## 3. DB Schema

### 3.1 Event Auto-Replies
```prisma
model AutoReplyRule {        // schema.prisma:498
  id             String   @id @default(uuid())
  companyId      String
  eventKey       String                       // one of 8 fixed keys
  isEnabled      Boolean  @default(true)
  messageBody    String                       // template, {name}/{orderId}/{brand}
  delayMinutes   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  useAI          Boolean  @default(false)
  brandVoice     String?  @default("friendly")
  targetLanguage String?  @default("en")
  logs           AutoReplyLog[]
  company        Company  @relation(fields:[companyId], references:[id], onDelete: Cascade)
  @@unique([companyId, eventKey])
  @@index([companyId]) @@index([eventKey]) @@index([isEnabled])
}
model AutoReplyLog {          // schema.prisma:519
  id String @id @default(uuid())
  companyId String; ruleId String?; eventKey String; triggeredFor String
  recipient String; channel String; messageBody String
  status String @default("SENT"); error String?; sentAt DateTime @default(now())
  company Company @relation(... onDelete: Cascade)
  rule AutoReplyRule? @relation(fields:[ruleId], references:[id])
  @@index([companyId]) @@index([ruleId]) @@index([sentAt]) @@index([status])
}
```

### 3.2 AI Instructions
```prisma
model ConversationalRule {    // schema.prisma:557
  id String @id @default(uuid())
  companyId String; name String; isEnabled Boolean @default(true)
  triggerKeywords String[] @default([])
  triggerType String @default("KEYWORD")
  conditions Json?
  templateBody String @default("")
  useAI Boolean @default(false)
  brandVoice String? @default("friendly")
  targetLanguage String? @default("auto")
  sourcePrompt String?                 // ← free-form instruction; WRITE-ONLY (never read)
  triggerCount Int @default(0); lastTriggeredAt DateTime?
  expiresAt DateTime?; createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  groupId String?; hourRange Json?; dateRange Json?; ruleType Int @default(1)
  company Company @relation(...); group RuleGroup? @relation(fields:[groupId], references:[id])
  logs ConversationalRuleLog[]; RuleDecisionLog RuleDecisionLog[]
  @@index([companyId]) @@index([companyId,isEnabled]) @@index([triggerKeywords])
  @@index([groupId]) @@index([companyId,ruleType]) @@index([dateRange],type:Gin) @@index([hourRange],type:Gin)
}
model RuleGroup {             // schema.prisma:540
  id String @id @default(uuid())
  companyId String; name String; description String?
  type String @default("AI_INSTRUCTION")   // AI_INSTRUCTION | EVENT_FLOW
  isEnabled Boolean @default(true)
  createdAt DateTime @default(now()); updatedAt DateTime @updatedAt
  rules ConversationalRule[]; company Company @relation(...)
  @@unique([companyId, name]) @@index([companyId]) @@index([companyId,type])
}
model ConversationalRuleLog { // schema.prisma:593
  id String @id; companyId String; ruleId String; conversationId String?
  leadId String?; inboundText String; responseSent String?; matchedKeyword String?
  aiGenerated Boolean @default(false); status String @default("TRIGGERED")
  error String?; createdAt DateTime @default(now())
}
model RuleDecisionLog {       // schema.prisma:615
  id String @id; companyId String; conversationId String?; messageText String
  topScore Float?; secondScore Float?; gap Float?; pathTaken String   // confident_match|ai_fallback|escalation
  matchedRuleId String?; blockedReason String?; createdAt DateTime @default(now())
}
model KnowledgeChunk {        // schema.prisma:694
  id String @id; companyId String; sourceType KnowledgeSourceType  // RULE|PRODUCT|POLICY|MANUAL
  sourceId String?; content String; embedding Unsupported("vector")?; isActive Boolean @default(true)
  @@unique([companyId, sourceType, sourceId])
}
```

### 3.3 Bot / shop settings that matter
```prisma
model BotConfiguration {      // schema.prisma:666  (1 per company, companyId @unique)
  id String @id; companyId String @unique
  botMenu Json?; botStructuredMenu Json?; botCommands Json?
  botKnowledgeBase String?; botLearnedContext String?
  botPolicies String? @default("")     // ← real "system instruction" text (Support/Policy RAG)
  createdAt DateTime; updatedAt DateTime
}
```
`Company` also has `botWelcomeMessage`, `customOooMessage` (offline message), `highValueThreshold`, `bulkItemThreshold`.

### 3.4 Sample rows (real data shape)
Event Auto-Replies are seeded (not in `seed.ts`); example `AutoReplyRule`:
```
id=uuid, companyId="company-demo-001", eventKey="order.confirmed", isEnabled=true,
messageBody="Great news {name}! Your order #{orderId} is confirmed...", delayMinutes=0,
useAI=false, brandVoice="friendly", targetLanguage="en"
```
AI Instructions example (from `ruleGeneratorService.generateFromPrompt` output, `ruleGenerator.service.ts:152`):
```
{ name:"Offer monsoon discount on sarees", triggerKeywords:["saree","discount","monsoon"],
  triggerType:"KEYWORD", templateBody:"Hi {{customerName}}, get 20% off all sarees this monsoon! 🌧️",
  useAI:false, brandVoice:"salesy", targetLanguage:"auto",
  conditions:{segment:["NEW"],timeRange:{start:8,end:22},language:["en","hi"]},
  sourcePrompt:"When a customer asks about sarees, give 20% monsoon discount", needsReview:false }
```
`RuleGroup`: `{ id, companyId, name:"Discounts", type:"AI_INSTRUCTION", isEnabled:true }`.

### 3.5 Redundant / overlapping fields
| Concept | Event Auto-Replies | AI Instructions | Overlap? |
|---|---|---|---|
| "message template" | `AutoReplyRule.messageBody` | `ConversationalRule.templateBody` | Both are `{name}/{brand}`-style templates → **duplicated concept** |
| "enable/disable" | `isEnabled` | `isEnabled` (+ `RuleGroup.isEnabled`) | Duplicated toggle |
| "use AI to rewrite" | `useAI` + `brandVoice` + `targetLanguage` | `useAI` + `brandVoice` + `targetLanguage` | **Byte-for-byte identical fields** in both models |
| "trigger condition" | `eventKey` (fixed 8) | `triggerKeywords` + `triggerType` + `conditions` (`hourRange`/`dateRange`/`segment`) | Different mechanisms, but both "decide when bot replies" |
| "instruction text" | none (messageBody is the instruction) | `sourcePrompt` (dead) | `sourcePrompt` duplicates intent of `messageBody` but is unused |
| "brand voice / language" | on `BotConfiguration` too (`ai_brand_voice`) | `aiPersonalityService` reads `BotConfiguration`, ignores rule-level `brandVoice` for AI path | Rule-level `brandVoice`/`targetLanguage` **redundant with `BotConfiguration`** in AI path |

---

## 4. Conflict / Overlap List

**Duplicate / overlapping behavior**
1. **`useAI`, `brandVoice`, `targetLanguage` exist in BOTH `AutoReplyRule` and `ConversationalRule`** with identical semantics — two places to configure the same AI-rewrite behavior.
2. **Two template fields** (`messageBody` vs `templateBody`) both support `{name}`/`{brand}` substitution — same templating concept, two code paths (`fillTemplate` vs `generateResponse`).
3. **Both systems can send into the same conversation.** Event Auto-Reply fires on an order event; the main AI loop fires on the customer's next message. With BOT mode, both dispatch → potential double bot message in one thread (e.g. order confirmed + AI answer). No de-dup between subsystems.
4. **AI Instructions influence the LLM twice**: as a hard canned reply (confident match) AND as soft context (`<ActiveConversationalRules>`). A single instruction can thus both *replace* the AI reply and *shape* it — ambiguous precedence if the rule's template contradicts the shop's general intent.

**Dead code / redundancy (AI Instructions made these redundant)**
5. **`ConversationalRule.sourcePrompt` is write-only dead data.** It is persisted (`conversationalRules.routes.ts:135,262`) but never read by any service, worker, or prompt. The actual behavior comes from `templateBody`/`triggerKeywords`. → Safe to drop or repurpose.
6. **`client.ts` `testSmartRule` / `getSmartRuleLogs` are unused** — the AI Instructions test UI reuses Event Auto-Replies endpoints (`/api/auto-reply/test-instruction`, `/generate-example`).
7. **`RuleGroup.type = "EVENT_FLOW"`** is an accepted enum value but no Event-Flow groups are created by the UI (default is `AI_INSTRUCTION`); effectively dead/unsupported path.
8. **Rule-level `brandVoice`/`targetLanguage` are ignored in the AI path** — `aiPersonalityService.getConfig` reads `BotConfiguration`, not the rule, so per-rule voice/language only matter in the *template-fill* path, not the Groq path. The fields mislead owners into thinking per-rule voice works.
9. **Fixed 8-key `AutoReplyRule.eventKey`** overlaps conceptually with what AI Instructions could cover (e.g. "welcome message" `lead.welcome` vs an AI Instruction "always greet warmly"). Both can greet the customer.

**Behavioral contradiction**
10. **`botPolicies` (BotConfiguration) is the de-facto "system instruction"** for Support/Policy intents (`ai.orchestrator.worker.ts:403`), yet it is edited in a *different* screen than "AI Instructions". Shop owners have **two separate "instruction" surfaces** (`botPolicies` and AI Instructions) with no UI linking them — a real source of conflicting guidance to the bot.

---

## 5. Options to Restructure Event Auto-Replies to reference/inherit AI Instructions

> No implementation. Each option assumes Event Auto-Replies keep firing on events, but stop duplicating AI-instruction concepts.

### Option A — AI Instructions becomes the single "brain"; Event Auto-Replies become thin event→instruction bindings
Make `AutoReplyRule` reference a `ConversationalRule` (or `RuleGroup`) instead of owning `messageBody`/`useAI`/`brandVoice`/`targetLanguage`. Event fires → looks up the bound AI Instruction → renders via the same `conversationalAutoReplyService`/`aiPersonalityService` path.
- **Pros:** One source of truth for templates/voice/language; kills the duplicated `messageBody`/`useAI` fields; `sourcePrompt` finally gets used (the bound instruction *is* the prompt); unified caching/invalidation.
- **Cons:** Event replies lose their simple static-template fallback (need AI or inherited template); migration of 8 seeded keys per company; `processEvent` must call into the conversational service — bigger refactor; risk if the bound instruction is disabled/expired.

### Option B — Collapse Event Auto-Replies into AI Instructions as a new `triggerType = "EVENT"` (single model)
Add `triggerType: "EVENT"` + `eventKey` to `ConversationalRule`. Delete `AutoReplyRule`. The orchestrator's event listeners call `conversationalAutoReplyService` (RAG-off, exact eventKey match) instead of `autoReplyService`.
- **Pros:** Single automation table, single UI, single embedding/cache; `sourcePrompt` becomes meaningful (it's the instruction that generates the event reply); removes all 8 duplicated fields at once; "AI Instructions" and "Event Auto-Replies" become two *views* over one dataset.
- **Cons:** Largest migration (move all `AutoReplyRule` rows → `ConversationalRule`); `AutoReplyLog` semantics change; the simple non-AI templated event reply currently needs no RAG/embedding — adding embedding overhead per event rule; the two `delayMinutes`/scheduling behaviors must be preserved (delayedAutoReply job).

### Option C — Keep two tables, but make Event Auto-Replies *inherit* AI Instructions config (no shared rows)
Leave `AutoReplyRule` as-is but: (1) drop its `useAI`/`brandVoice`/`targetLanguage` and instead read them from the shop's AI Instructions "global profile" (`BotConfiguration` / a designated `RuleGroup`); (2) surface `botPolicies` inside the AI Instructions UI so owners edit one instruction surface; (3) inject *active event templates* into the main LLM prompt too (symmetry with `<ActiveConversationalRules>`).
- **Pros:** Smallest change, lowest risk, no data migration; removes field duplication by inheritance; unifies the "instruction" UX; clarifies precedence (events vs messages).
- **Cons:** Still two tables and two code paths; `messageBody` template duplication remains; doesn't fully solve the double-send-in-one-thread problem (needs a cross-system de-dup guard regardless of option).

### Recommendation
Adopt **Option C first** (quick win: kills duplicated `useAI`/voice fields, merges the two instruction UIs via `botPolicies`, adds cross-system de-dup), then plan **Option B** as the strategic consolidation. Option A is a middle ground if you want to keep `AutoReplyRule` for scheduler/simplicity reasons. Whichever you pick, add a **single "bot-reply coordinator"** that, given a conversation + trigger, decides event-reply vs message-reply vs AI to prevent overlapping outbound messages (the core conflict in §4.3).

---

*End of report. No files were modified.*
