# LeadSync Backend Architectural Audit Report

*Prepared for academic/research purposes*

---

## 1. HIGH-LEVEL ARCHITECTURE

### Major Modules/Services/Directories

| Directory/File | Purpose |
|----------------|---------|
| `src/services/workers/ai.orchestrator.worker.ts` | Main message processing pipeline; receives webhook jobs, handles routing decisions, triggers AI or rule-based responses |
| `src/services/automation/conversationalAutoReply.service.ts` | Stage 3 rule-matching engine using RAG similarity search; evaluates inbound messages against smart rules |
| `src/services/automation/autoReply.service.ts` | Event-driven auto-replies (order status, lead welcome, follow-ups) with delayed scheduling via pg-boss |
| `src/services/ai/ai.service.ts` | Core LLM interaction layer using Groq (Llama-3.3-70b); intent classification, order extraction, response generation |
| `src/services/ai/languageDetection.service.ts` | Indian language detection via Sarvam AI API with Unicode script-range fallback |
| `src/services/ai/aiPersonality.service.ts` | Brand voice personalization and translation via Sarvam AI for Indian languages |
| `src/services/knowledge/ruleEmbedding.service.ts` | Embeds ConversationalRules into KnowledgeChunk table for RAG similarity search |
| `src/services/knowledge/knowledgeRetriever.service.ts` | Raw pgvector cosine similarity retrieval of knowledge chunks |
| `src/services/outbound.dispatcher.ts` | Channel-agnostic message dispatch (Telegram, WhatsApp, Instagram) with atomic status logging |
| `src/services/assignment.service.ts` | Staff assignment logic; finds least-loaded online staff, handles escalation to HUMAN mode |
| `src/services/automation/leadFollowUp.cron.ts` | Scheduled job (30-min interval) for cold lead recovery and follow-ups |
| `src/services/workflow/newOrderArrival.service.ts` | New order workflow with product matching and pricing suggestions |
| `src/services/integrations/crm.service.ts` | Lead lifecycle and CRM scoring logic |
| `src/lib/socket.ts` | Socket.IO server setup for realtime conversation updates |
| `prisma/` | PostgreSQL schema with pgvector extension for embeddings |

### Request Flow (Text Diagram)

```
Incoming Message (Telegram/WhatsApp/Web)
         ↓
    webhook.routes.ts (ingestion, idempotency check)
         ↓
  webhook.process job (pg-boss queue)
         ↓
  [ai.orchestrator.worker.ts]
         ↓
  ┌─────────────────────────────────────────────────────────┐
  │ Lead Lock (ConcurrencyLock) ensures idempotent creation │
  │ ↓                                                       │
  │ Out-of-Office Check? → OOO reply + return               │
  │ ↓                                                       │
  │ Conversation mode === HUMAN? → Persist + return         │
  │ ↓                                                       │
  │ BOT_COMMAND (/start)? → Persist + return               │
  │ ↓                                                       │
  │ Parallel execution:                                      │
  │   1. conversationalAutoReplyService.evaluateMessage()   │
  │      ──► retrieveSimilarChunks() (RAG similarity)       │
  │      ──► checkRuleEligibility() (time/segment/lang)     │
  │      ──► confidence-gap check (CONFIDENCE_GAP_THRESHOLD)│
  │   2. generateShopReply() (Groq LLM classification)      │
  │ ↓                                                       │
  │ Decision Logic:                                          │
  │   - Escalation signal? → HUMAN mode + assign staff      │
  │   - Rule matched (gap ≥ 0.04)? → Send auto-reply        │
  │   - Else → LLM response via generateShopReply()         │
  │ ↓                                                       │
  │ outboundDispatcher.dispatch() → Channel transport         │
  │ ↓                                                       │
  │ Socket.IO emit: conversation_updated, conversation.escalated│
  └─────────────────────────────────────────────────────────┘
```

### External Services/APIs Integrated

| Service | Provider | Purpose | Location |
|---------|----------|---------|----------|
| Embeddings | `@xenova/transformers` (Xenova/multilingual-e5-small) | 384-dim normalized vectors for similarity search | `src/utils/embedding.ts` |
| LLM Generation | Groq API (Llama-3.3-70b-versatile) | Intent classification, response generation, menu restructuring | `src/services/ai/ai.service.ts` |
| Language Detection | Sarvam AI (`text-lid` endpoint) | Detect Indian language codes (en, hi, ta, te, bn, gu, kn, ml, mr, pa, ur) | `src/services/ai/languageDetection.service.ts` |
| Translation | Sarvam AI (`translate` endpoint) | English-to-Indian-language translation | `src/services/ai/aiPersonality.service.ts` |
| Payment Processing | Razorpay | Payment webhook handling, invoice generation | `src/services/integrations/payment.service.ts` (referenced) |
| Messaging | Telegram Bot API | Outbound Telegram messages | `src/services/transport/telegramTransport.service.ts` |
| Messaging | Meta WhatsApp/Instagram API | Outbound WhatsApp/Instagram messages | `src/services/adapters/meta.adapter.ts` |
| Email | SMTP via Nodemailer + Resend | Password reset, invite emails | `src/services/integrations/email.service.ts` |
| PDF Generation | PDFKit | Invoice PDF generation | `src/services/integrations/invoice.service.ts` |

---

## 2. AI/ML COMPONENTS

### Embeddings Generation, Storage, and Querying

| Component | Model/Provider | Dimensions | Normalization | Storage Location |
|-----------|---------------|------------|-------------|-----------------|
| `embedText()` | Xenova/multilingual-e5-small | 384 | L2-normalized via `pooling: "mean", normalize: true` | `src/utils/embedding.ts` |
| KnowledgeChunk embedding | Same (via embedText) | 384 | Stored as `Unsupported("vector(384)")` | `prisma/schema.prisma` line 642 |

**Embedding Flow:**
1. `src/services/knowledge/ruleEmbedding.service.ts` — embeds ConversationalRule into KnowledgeChunk
2. Content format: `${rule.name} ${triggerKeywords.join(" ")} ${templateBody}`
3. Raw SQL upsert into KnowledgeChunk with `sourceType='RULE'` and `sourceId=rule.id`

**Similarity Query Flow:**
1. `src/services/knowledge/knowledgeRetriever.service.ts` — uses pgvector's `<=>` operator
2. Distance formula: `cosine_distance = (embedding <=> query_vector)`
3. Similarity derived: `similarity = 1 - distance` (intuitive 1.0=perfect, 0.0=unrelated)

### LLM Calls for Generation

| Function | Model | Prompt Structure | Grounding/Context Passed | Guardrails/Validation |
|----------|-------|-----------------|-------------------------|----------------------|
| `generateShopReply()` | Llama-3.3-70b-versatile (Groq) | System: `compileDynamicOmniPrompt()` + Context envelope with `<MerchantRules>`, `<RegionalLinguisticHeuristics>`, `<ActiveMerchantMenuSnapshot>`, `<ActiveConversationalRules>`, `<DetectedLanguage>` tags | `session_state`, `retrieved_items` (inventory), `menu_snapshot`, `detected_language`, `activeRules` context | JSON schema enforcement, `response_format: { type: "json_object" }`, `temperature: 0.1`, fallback to error message on parse failure |
| `generateProductSmartReply()` | Llama-3.3-70b-versatile | Brand voice + product context prompt | `productName`, `price`, `customerName`, `location`, `threadHistory` | `temperature: 0.5`, fallback template on error |
| `polishText()` | Llama-3.3-70b-versatile | Senior customer success writer persona | `draft`, optional `productContext` | `temperature: 0.3`, returns original draft on failure |
| `restructureMenu()` | Llama-3.3-70b-versatile | Menu restructuring schema prompt | `shopDescription`, `existingMenu`, `businessType`, `localizedHeuristics` | JSON-only response format |
| `triageConversation()` | Llama-3.3-70b-versatile | Intent classifier (Sales/Support/Spam) | `threadHistory` only | JSON response with `intent` and `summary` |

**Key Guardrails:**
- `escapeHtmlBrackets()` prevents XML/prompt injection in context envelope
- Fallback responses when AI unavailable (never throws)
- SchemaType enforcement for JSON responses
- `confidence: 0` triggers fallback mode in `generateShopReply()`

### Rule Matching Pipeline (Stage 3)

**Eligibility Checks (conversationalAutoReply.service.ts lines 138-174):**
- `checkHourCondition()`: Hour-of-day range filter (start, end in 0-23)
- `checkDateCondition()`: Day-of-month range filter (start, end in 1-31)  
- `checkSegmentCondition()`: Customer segment filter (NEW, REGULAR, VIP, CHURN_RISK)
- `checkLanguageCondition()`: Customer language preference filter

**BlockedReason Values:**
- `"ineligible_time"` — Hour or date range exclusion
- `"ineligible_segment"` — Customer segment mismatch
- `"ineligible_language"` — Language condition mismatch
- `"gap_below_threshold"` — Top/bottom similarity gap < 0.04
- `"rule_not_found"` — No matching rules found

**Confidence-Gap Logic (lines 203-228):**
- `CONFIDENCE_GAP_THRESHOLD = 0.04` (configurable via env)
- For >=2 eligible rules: `gap = topScore - secondScore`
- Match if `gap >= 0.04`
- **Single-rule case**: Always routes to AI (no confident path) — this is a deliberate design decision documented in code comments

**RuleDecisionLog Schema (prisma/schema.prisma lines 550-569):**
```prisma
model RuleDecisionLog {
  id             String   @id @default(uuid())
  companyId      String
  conversationId String?
  messageText    String
  topScore       Float?
  secondScore    Float?
  gap            Float?
  pathTaken      String   // "confident_match" | "ai_fallback" | "escalation"
  matchedRuleId  String?
  blockedReason  String?  // null if matched
  createdAt      DateTime @default(now())
}
```

### Reranking, Classification, and Scoring Beyond Cosine Similarity

- **No reranking layer** — Direct cosine similarity from pgvector
- **Classification**: `intent_type` from LLM with values `"Checkout" | "Query" | "Support"`
- **Sentiment scoring**: LLM-provided sentiment (POSITIVE/NEUTRAL/NEGATIVE) converted to numeric (-1/0/1)
- **Confidence threshold**: `detected_meta.confidence > 0.3` used for escalation decisions

### Multilingual/Multi-Script Handling

| Component | Languages Supported | Detection Method | Handling |
|-----------|-------------------|-----------------|--------|
| Language detection | en, hi, ta, te, bn, gu, kn, ml, mr, pa, ur | Sarvam AI `/text-lid` API OR Unicode range fallback | Unicode ranges: Tamil (U+0B80–U+0BFF), Devanagari (U+0900–U+097F), Telugu (U+0C00–U+0C7F), Bengali (U+0980–U+09FF), Gujarati (U+0A80–U+0AFF), Kannada (U+0C80–U+0CFF), Malayalam (U+0D00–U+0D7F), Punjabi/Gurmukhi (U+0A00–U+0A7F), Urdu (U+0600–U+06FF) |
| Translation | Same 11 languages | LLM detects, Sarvam translates | `targetLanguage` per rule, `formal` mode |
| Multilingual prompt | Explicit instructions for Hinglish, Tanglish, Manglish | Prompt-level handling | System prompt instructs: "reply in EXACT SAME language as the customer" |

---

## 3. AUTOMATIONS

| Feature | Trigger | Action | Type |
|---------|---------|--------|------|
| Order status auto-reply | `Events.ORDER_STATUS_CHANGED` (CONFIRMED, PREPARING, READY, DELIVERED) | Send templated message via outboundDispatcher | Rule-based (deterministic) |
| Order placed auto-reply | `Events.ORDER_CREATED` | Send "order.placed" message | Rule-based |
| Lead welcome | New lead creation | Send "lead.welcome" message | Rule-based |
| Lead follow-up | Cron (30-min interval) — 24h inactive | Send "lead.followup" message | Rule-based/scheduled |
| Cold lead recovery | Cron (30-min interval) — 72h inactive | Send "lead.cold_recovery" message | Rule-based/scheduled |
| Delayed auto-reply | `rule.delayMinutes > 0` for segment-specific timing | pg-boss scheduled job | Rule-based with configurable delays |
| Conversational rule auto-reply | Inbound message similarity match | Send rule template (optionally AI-enhanced) | AI-driven (RAG similarity) |
| Payment webhook | Razorpay `payment_link.paid` event | Update order to PAID, generate invoice, notify conversation | Rule-based/event-driven |

**Segment-Based Delay Overrides (autoReply.service.ts lines 227-236):**
- VIP: 60 minutes delay (override)
- REGULAR: Default rule delay
- NEW: 1440 minutes (24h) delay
- CHURN_RISK: 0 minutes (immediate)

---

## 4. DATA & LOGGING

### Prisma Models (Tables)

| Model | One-line Purpose |
|-------|-----------------|
| `Company` | Tenant organization with Telegram/Instagram/WhatsApp integration tokens |
| `User` | Staff/owner accounts with role-based access (OWNER, MANAGER, STAFF) |
| `Lead` | Customer contact with channel, segment (NEW/REGULAR/VIP/CHURN_RISK), lastActiveAt tracking |
| `Product` | SKU-based inventory with pricing, stock tracking |
| `Order` | Transactional order linking lead, conversation, conversation status lifecycle |
| `OrderItem` | Line items for each order |
| `OrderLog` | Audit trail for order status changes and actions |
| `Invoice` | Generated invoices linked to orders |
| `Conversation` | Messaging thread with BOT/HUMAN mode, assignment fields, lifecycleStatus |
| `Message` | Individual messages with sender (CLIENT/AGENT/SYSTEM), delivery status |
| `BotKnowledge` | FAQ/knowledge base entries (manual, not embedded) |
| `AutomationRule` | Scheduled workflow triggers (separate from ConversationalRule) |
| `AutomationLog` | Execution logs for AutomationRules |
| `AutoReplyRule` | Event-driven auto-reply templates (order.placed, lead.welcome, etc.) |
| `AutoReplyLog` | Sent/failed/pending logs for auto-reply events |
| `RuleGroup` | Container for grouping ConversationalRules |
| `ConversationalRule` | Smart reply rules with triggerKeywords, conditions, templateBody, AI flags |
| `ConversationalRuleLog` | Execution logs for conversational rule matches |
| `RuleDecisionLog` | Decision pipeline observability: scores, gap, pathTaken, blockedReason |
| `KnowledgeChunk` | pgvector-stored embeddings (RULE, PRODUCT, POLICY, MANUAL source types) |
| `Broadcast` | Bulk messaging to lead segments/tags |
| `Notification` | Realtime user notifications (socket + DB persistence) |
| `NotificationTemplate` | Localized notification templates |
| `BotConfiguration` | Structured menu, policies, learned context, AI settings |
| `ClaimLog` | Staff claim/assignment history |
| `InternalNote` | Conversation notes from staff |
| `Invitation` | Staff invitation tokens |
| `PostalPincodeIndex` | India postal database (~155k PIN records) |
| `Idempotency` | Deduplication key-value store for API calls |
| `IncomingWebhook` | Raw webhook payload storage |
| `AgentFeedPost` | Staff activity feed posts |

### Decision/Outcome/Feedback Tables for Retrospective Evaluation

| Table | Evaluation Use Case |
|-------|---------------------|
| `RuleDecisionLog` | Full observability of rule matching: `topScore`, `secondScore`, `gap`, `pathTaken`, `blockedReason` — enables analysis of confidence distributions, fallback rates |
| `ConversationalRuleLog` | Rule execution outcomes: which rules triggered, with `aiGenerated` flag |
| `AutoReplyLog` | Auto-reply delivery success/failure, timing analysis |
| `OrderLog` | Order workflow performance, status transition timing |

---

## 5. ESCALATION / HUMAN-IN-THE-LOOP

### Escalation Logic

**Trigger Conditions (ai.orchestrator.worker.ts lines 504-522):**
```typescript
const needsHumanEscalation =
  (detected_meta?.confidence ?? 0) > 0.3 &&
  (intent_type === "HUMAN_HANDOFF" ||
    intent_type === "Support" ||
    (detected_meta?.sentiment === "NEGATIVE" && resolvedScore < 0));
```

**Escalation Reasons (mapped lines 510-522):**
- `"manual_request"` — `intent_type === "HUMAN_HANDOFF"`
- `"complaint"` — `intent_type === "Support"` OR `sentiment === "NEGATIVE"`
- `"order_confirm"` — Order extracted with items/total > 0

**Post-Escalation Actions:**
1. Set `conversation.mode = "HUMAN"`
2. Set `conversation.needsStaffReason`
3. Assign least-loaded online staff via `findLeastLoadedStaff()` (updates `claimedById`, `claimedByName`, `claimedAt`)
4. Log to `RuleDecisionLog` with `pathTaken: "escalation"`
5. Emit socket events:
   - `conversation.escalated` to assigned agent (if found)
   - `conversation.escalated` to company admin (if unassigned)
   - `conversation.escalated` with `_note: "UNASSIGNED"` if no online staff
6. Create notification via `notificationService`

**SLA/Timing Tracking:**
- No explicit SLA tracking (no time-to-response SLA metrics)
- `claimedBy` assignment enables UI to show which agent owns the conversation
- No escalation timeout or re-routing logic implemented

---

## 6. NOTABLE ENGINEERING DECISIONS

### Deliberate Custom Designs Over Naive Approaches

| Decision | Alternative Rejected | Rationale |
|----------|---------------------|-----------|
| Single-rule companies always route to AI (no confident match) | Default absolute-score threshold | Code comment (line 211): "Single-rule case: always route to AI (no confident path)" — prevents false positives when only one rule exists |
| `escapeHtmlBrackets()` injection defense | Raw string interpolation | Prevents prompt injection via `<MerchantRules>` envelope — explicit XML boundary guards |
| pg_boss advisory lock for idempotency (autoReply.service.ts) | Simple in-memory deduplication | Ensures atomic check-reserve pattern across process restarts in distributed deployment |
| Unicode fallback for language detection | API-only detection | Sarvam AI may be unavailable; zero-dependency fallback ensures system continues |
| Offline PIN code lookup | DB-only lookup | `OFFLINE_PIN_PREFIX_MAP` ensures order validation continues if PostalPincodeIndex table is unprovisioned |
| `hourRange` / `dateRange` as JSON | Separate columns | Flexible time-based conditions without schema migrations per rule variant |
| Confidence-gap over absolute score | Threshold-only approach | Gap-based confidence (top - second) reduces false positives from high-scoring irrelevant matches |

### Performance/Scale Considerations

| Concern | Implementation |
|---------|----------------|
| Concurrency protection | `ConcurrencyLock.withConversationLock()` uses `pg_advisory_xact_lock` for atomic DB writes |
| Rule caching | 60-second TTL in-memory cache (`rulesCache`) in `conversationalAutoReply.service.ts` |
| Rate limiting | Express-rate-limit (20 req/15min for auth, 200 req/min general) |
| Ghost cleanup | "Ghost Reaper" service (15-min interval) cleans stale/orphan conversations |
| Indexing | pgvector index on `(companyId, isActive)` for KnowledgeChunk queries |
| Batched processing | pg-boss `batchSize: 5` for webhook jobs |
| Team concurrency | `teamSize: 5, teamConcurrency: 2` for ai-triage-job worker |
| Memory guardrail | Diagnostic endpoint `/api/debug/resources` reads cgroup memory limits |

---

## 7. GAPS / INCOMPLETE AREAS

### Designed But Not Yet Implemented

| Area | Evidence |
|------|----------|
| Webhook ingestion route (`api/webhook`) | `webhook.routes.ts` only contains Razorpay handler; Telegram webhook handler at `telegram.routes.ts` but no `/api/webhook/message` for generic inbound |
| `suggested_human_response` escalation leg | Code removed in BUG_4_ESCALATION_PREP.md but `suggested_human_response` field still populated by LLM — no consumer |
| `SINGLE_RULE_MIN_SCORE` environment variable | Defined in service (line 51) but never referenced in logic — dead code |
| `hourRange`/`dateRange` on ConversationalRule | Schema has JSON fields but no database migration applied (migration at `20260708000000_split_timeRange` exists) |
| Product embedding to KnowledgeChunk | `sourceType` enum includes PRODUCT but no service writes PRODUCT embeddings |
| `ruleGroups` API has no enable/disable flag | Group exists but no batch activation control |

### Implemented But Not Yet Evaluated/Tested With Real Data

| Area | Evidence |
|------|----------|
| ConversationalRule similarity matching accuracy | `CONFIDENCE_GAP_THRESHOLD` set to 0.04 but no validation data; scripts like `test_retriever.mjs`, `e2e_embed_test.mjs` are test harnesses |
| Escalation false-positive rate | BUG_4_ESCALATION_PREP.md documents 3 misfires but fix not yet applied; `suggested_human_response.length > 10` trigger fires on routine queries |
| Language detection accuracy on code-mixed text | Sarvam API integration exists but no test dataset for Hinglish/Tanglish/Manglish |
| Memory consumption under load | `/api/debug/resources` endpoint suggests monitoring concern but no production data |
| Cache invalidation on rule update | `invalidateCache()` called but no verification of cache coherence across multiple workers |

---

## Appendix: Key File References

| Component | Primary Files |
|-----------|--------------|
| Request Flow | `src/services/workers/ai.orchestrator.worker.ts`, `src/routes/webhooks/webhook.routes.ts` |
| Embedding | `src/utils/embedding.ts`, `src/services/knowledge/ruleEmbedding.service.ts`, `src/services/knowledge/knowledgeRetriever.service.ts` |
| LLM Generation | `src/services/ai/ai.service.ts`, `src/services/ai/aiPersonality.service.ts` |
| Rule Matching | `src/services/automation/conversationalAutoReply.service.ts` |
| Escalation | `src/services/assignment.service.ts`, `src/services/infrastructure/notification.service.ts` |
| Automation | `src/services/automation/autoReply.service.ts`, `src/services/automation/autoReplyEventListeners.ts` |
| Database Schema | `prisma/schema.prisma` |