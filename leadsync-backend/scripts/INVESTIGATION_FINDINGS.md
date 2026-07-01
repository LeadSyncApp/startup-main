# Conversation.status Enum Drift — Full Investigation Findings

Generated: 2026-07-01

## SECTION 1 — Full grep -rn "\.status\b" across backend src/ (domain-model hits only)

Excluded: HTTP `res.status()`, lib/api.ts response status, middleware error codes, adapter-level `let status: number`.

| File | Line/Context | Classification | Value source |
|------|-------------|----------------|--------------|
| `src/routes/leads/leads.routes.ts` | `status: conversation?.status \|\| "OPEN"` | **Read + fallback literal** | Hardcoded `"OPEN"` |
| `src/services/assignment.service.ts` | `status: { notIn: ["RESOLVED", "ARCHIVED"] }` | **Where filter** | Hardcoded strings |
| `src/services/assignment.service.ts` | `status: updated.status` (resolve path) | **Write** | Variable from `updated` object |
| `src/services/assignment.service.ts` | `status: updated.status` (escalate path) | **Write** | Variable |
| `src/services/workers/ai.orchestrator.worker.ts` | `status: escalatedConvo.status` | **Read + write propagation** | Pass-through from fetched row |
| `src/services/outbound.dispatcher.ts` | Line 77: `tx.conversation.update({ where: ..., data: { updatedAt: new Date() } })` | **Read-back failure** | No status written; Prisma fails deserializing DB enum into String |

**Total domain-model sites: 6** (3 read, 2 write, 1 read-back failure)

---

## SECTION 2 — Line 77 context from outbound.dispatcher.ts

```ts
// Line 77 — schema.prisma maps Conversation.status as String
await tx.conversation.update({
  where: { id: conversationId, companyId },
  data: {
    updatedAt: new Date()
  }
});
```

**Verdict: READ-BACK failure, not a write failure.**

The code never writes `status` at this line. Prisma executes the UPDATE on `updatedAt`, then reads the row back to return the updated object. During deserialization, Prisma expects `status` to be a plain `String` (per schema.prisma), but PostgreSQL returns the `ConversationStatus` enum value `"ASSIGNED"`. The type coercion fails, the `$transaction` rolls back, and the entire atomic ledger entry is lost.

This means **the dispatcher has been silently broken for every outbound message** since `Conversation.status` was added as an enum in the live DB but never updated in schema.prisma.

---

## SECTION 3 — Full output of information_schema query (all USER-DEFINED enum columns)

```
=== ALL USER-DEFINED (ENUM) COLUMNS IN LIVE DB ===
[
  {"column_name":"scale","udt_name":"BusinessScale","table_name":"Company"},
  {"column_name":"channel","udt_name":"Channel","table_name":"Conversation"},
  {"column_name":"intent","udt_name":"ConversationIntent","table_name":"Conversation"},
  {"column_name":"mode","udt_name":"ConversationMode","table_name":"Conversation"},
  {"column_name":"status","udt_name":"ConversationStatus","table_name":"Conversation"},
  {"column_name":"status","udt_name":"IdempotencyStatus","table_name":"Idempotency"},
  {"column_name":"role","udt_name":"Role","table_name":"Invitation"},
  {"column_name":"status","udt_name":"InvitationStatus","table_name":"Invitation"},
  {"column_name":"aiPriority","udt_name":"AiPriority","table_name":"Lead"},
  {"column_name":"channel","udt_name":"Channel","table_name":"Lead"},
  {"column_name":"pendingOrderState","udt_name":"PendingOrderState","table_name":"Lead"},
  {"column_name":"segment","udt_name":"LeadSegment","table_name":"Lead"},
  {"column_name":"status","udt_name":"LeadStatus","table_name":"Lead"},
  {"column_name":"platform","udt_name":"Channel","table_name":"Message"},
  {"column_name":"sender","udt_name":"MessageSender","table_name":"Message"},
  {"column_name":"approvalStatus","udt_name":"OrderApprovalStatus","table_name":"Order"},
  {"column_name":"priority","udt_name":"OrderPriority","table_name":"Order"},
  {"column_name":"source","udt_name":"OrderSource","table_name":"Order"},
  {"column_name":"sourceChannel","udt_name":"SourceChannel","table_name":"Order"},
  {"column_name":"status","udt_name":"OrderStatus","table_name":"Order"},
  {"column_name":"onboardingStatus","udt_name":"OnboardingStatus","table_name":"User"},
  {"column_name":"role","udt_name":"Role","table_name":"User"}
]

ENUM RANGES:
- BusinessScale:        ["HOME_GROWN","SME_RETAIL"]
- Channel:              ["WEBSITE","TELEGRAM","WHATSAPP","INSTAGRAM"]
- ConversationIntent:   ["BROWSING","ORDERING","SUPPORT","COMPLAINT"]
- ConversationMode:     ["BOT","HUMAN"]
- ConversationStatus:   ["OPEN","ASSIGNED","RESOLVED","SNOOZED"]
- IdempotencyStatus:    ["PROCESSING","COMPLETED","FAILED"]
- Role:                 ["OWNER","MANAGER","STAFF"]
- InvitationStatus:     ["PENDING","ACCEPTED","EXPIRED","REVOKED"]
- AiPriority:           ["HIGH","MEDIUM","LOW"]
- PendingOrderState:    ["NONE","PENDING_APPROVAL","CLAIMED_FOR_APPROVAL"]
- LeadSegment:          ["NEW","REGULAR","VIP","CHURN_RISK"]
- LeadStatus:           ["NEW","CLAIMED","ARCHIVED"]
- MessageSender:        ["CLIENT","AGENT","SYSTEM"]
- OrderApprovalStatus:  ["PENDING","APPROVED","REJECTED"]
- OrderPriority:        ["NORMAL","URGENT"]
- OrderSource:          ["MANUAL","BOT_DETECTED"]
- SourceChannel:       ["WEBSITE","TELEGRAM","WHATSAPP","INSTAGRAM","META"]
- OrderStatus:          ["NEW","CONFIRMED","PREPARING","READY","DELIVERED","CANCELLED","BOT_CREATED_ORDER","PENDING","PAID","PROCESSING","SHIPPED","COMPLETED","REJECTED","ARCHIVED","USER_CONFIRMED_PENDING_AGENT"]
- OnboardingStatus:     ["PENDING","INVITE_ACCEPTED","ONBOARDED"]
```

---

## SECTION 4 — Conversation.intent details

**Live DB enum:** ConversationIntent with values: `["BROWSING", "ORDERING", "SUPPORT", "COMPLAINT"]`

**schema.prisma:** The field `intent` does **not exist at all** in the Conversation model.

**Code sites referencing conversation.intent:**

| File | Classification |
|------|----------------|
| `src/services/automation/autoReply.service.ts` | Reads/writes intent on Conversation |
| `src/services/workers/ai.orchestrator.worker.ts` | Reads `conversation.intent` |
| `src/routes/leads/leads.routes.ts` | Writes intent in Conversation select/update |
| `src/services/workflow/automation.service.ts` | May read intent for rule matching |

---

## SECTION 5 — Proposed fix (description only)

### schema.prisma changes:

1. Add enum blocks (near existing enums at top of file):
   ```prisma
   enum ConversationStatus {
     OPEN
     ASSIGNED
     RESOLVED
     SNOOZED
   }

   enum ConversationIntent {
     BROWSING
     ORDERING
     SUPPORT
     COMPLAINT
   }
   ```

2. In `model Conversation`:
   - Change: `status String @default("open")` → `status ConversationStatus @default(OPEN)`
   - Add: `intent ConversationIntent @default(BROWSING)`

### Code site changes:

| File | Current code | Required change |
|------|-------------|-----------------|
| `src/routes/leads/leads.routes.ts` | `status: conversation?.status \|\| "OPEN"` | `status: conversation?.status \|\| ConversationStatus.OPEN` |
| `src/services/assignment.service.ts` | `status: { notIn: ["RESOLVED", "ARCHIVED"] }` | `status: { notIn: [ConversationStatus.RESOLVED, ConversationStatus.SNOOZED] }` (note: ARCHIVED is not a valid ConversationStatus value — this may be a LeadStatus value, so needs careful review) |
| `src/services/assignment.service.ts` | `status: updated.status` writes | No literal change needed if Prisma type is correct |
| `src/services/workers/ai.orchestrator.worker.ts` | `status: escalatedConvo.status` | No literal change needed if Prisma type is correct |
| `src/services/outbound.dispatcher.ts` | Line 77 read-back failure | **No code change needed** — fixing schema.prisma's `Conversation.status` type fixes the read-back deserialization automatically |

### Order of operations:
1. Modify schema.prisma (add both enums, change status type, add intent field)
2. Run `npx prisma generate`
3. Update `leads.routes.ts` and `assignment.service.ts` string literals → enum references
4. Verify `assignment.service.ts:63` — "ARCHIVED" is not a valid ConversationStatus value; this may be a bug that was masked by the String type
5. Run `npx tsc --noEmit`
6. Re-run `scripts/testOutboundSmoke.tsx` — must pass with zero Prisma conversion errors

---

**Total mismatches: 2** (Conversation.status String→enum, Conversation.intent missing entirely)

**Total code sites requiring string→enum literal changes: 2** (leads.routes.ts, assignment.service.ts)

**Note:** The `notIn: ["RESOLVED", "ARCHIVED"]` filter in `assignment.service.ts:63` references `"ARCHIVED"`, which is NOT a valid ConversationStatus enum value (the valid values are OPEN/ASSIGNED/RESOLVED/SNOOZED). This suggests the filter was incorrectly copied from Lead.status logic and has been silently broken (always returning all rows because "ARCHIVED" never matches). This may need to be `"SNOOZED"` instead, but that requires domain knowledge to confirm.