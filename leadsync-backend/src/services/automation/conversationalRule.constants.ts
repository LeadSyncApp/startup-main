/**
 * Shared constants + catalog for ConversationalRule surfacing & event triggers.
 *
 * These values are consumed by both the backend (routes, adapter, order workflow)
 * and the frontend (rule editor) so the two sides can never drift.
 */

// ============================================================
// SURFACING CAP (v1 simplification — see note below)
// ============================================================
//
// v1 uses a GLOBAL PER-BOT cap: a company may have at most MAX_SURFACED_RULES
// enabled-surfaced rules. The cap is enforced at WRITE TIME (create/update), not
// just at render time, so a rule that "falls off the end" is never invisibly dead.
//
// NOTE: This is intentionally global per-bot, not per-conversation-context. A
// richer v2 design would surface only buttons relevant to the current flow/reply.
// Do NOT mistake the global cap for that final design.
export const MAX_SURFACED_RULES = 6;

// ============================================================
// EVENT TRIGGER NAMING CONVENTION
// ============================================================
//
// eventConfig.eventName uses a dotted, lowercase convention: `<domain>.<event>`.
// Order-status events are emitted as `order.<status-lowercased>` by
// orderWorkflow.service.ts (e.g. order.shipped, order.delivered). The matcher in
// conversationalAutoReply.service.ts performs an exact, case-sensitive match, so a
// rule's eventName MUST be exactly one of the values in KNOWN_EVENTS below.
//
// The UI MUST only ever let users pick from KNOWN_EVENTS (no free-text entry) so the
// casing/mismatch failure mode cannot occur at the input layer.
export const ORDER_EVENT_PREFIX = "order.";

export interface KnownEvent {
  /** Exact value stored in eventConfig.eventName and matched by the service. */
  value: string;
  /** Human-readable label for the dropdown. */
  label: string;
}

/**
 * Catalog of known event triggers. Order events are derived from the Prisma
 * OrderStatus enum (uppercased); we lowercase the suffix to form the event name.
 * Keep this list in sync with the OrderStatus enum in schema.prisma.
 */
const ORDER_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
  "BOT_CREATED_ORDER",
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "COMPLETED",
  "REJECTED",
  "ARCHIVED",
  "USER_CONFIRMED_PENDING_AGENT",
] as const;

export const KNOWN_EVENTS: KnownEvent[] = [
  ...ORDER_STATUSES.map((s) => ({
    value: `${ORDER_EVENT_PREFIX}${s.toLowerCase()}`,
    label: `Order: ${s
      .toLowerCase()
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")}`,
  })),
];
