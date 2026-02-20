# LeadSync CRM: Order Workflow & Scale Architecture
**Version:** 1.0.0
**Author:** Senior SaaS Product Architect (AI)
**Date:** 2026-02-20

## 1. Executive Summary
This document outlines the architectural redesign of the Order Management System (OMS) for LeadSync. The goal is to move from a simple data-entry system to a **state-machine driven, audit-compliant, and multi-agent scalable workflow**.

Core Requirement: **Strict enforcement of Bot-to-Agent handoff and immutable audit logs.**

---

## 2. Database Design (Prisma Schema)

We introduce a strictly typed state machine and a dedicated logging table for audit trails.

### 2.1 Enums
```prisma
enum OrderStatus {
  // Pre-Order
  BOT_DETECTED    // (New) Bot found intent, created draft order. Invisible on main board? Or "New"?
  
  // Active Pipeline
  PENDING_ACTION  // (New) Needs Agent Acceptance.
  CONFIRMED       // Agent Accepted. Processing starts.
  PREPARING       // Kitchen/Warehouse working.
  READY           // Ready for pickup/shipping.
  SHIPPED         // Out for delivery.
  
  // Terminal States
  DELIVERED       // Success.
  CANCELLED       // Cancelled by user/agent.
  REJECTED        // Rejected by agent (Fake order).
  ARCHIVED        // Soft deleted.
}

enum OrderChangeType {
  STATUS_CHANGE
  ASSIGNMENT_CHANGE
  NOTE_ADDED
  ITEM_UPDATE
}
```

### 2.2 Models
```prisma
model Order {
  id              String        @id @default(uuid())
  shortId         String        @unique @default(cuid()) // For easier human reference?
  
  // ... existing fields ...
  
  status          OrderStatus   @default(BOT_DETECTED)
  
  // Concurrency Control
  version         Int           @default(1) // Optimistic Locking
  
  // Relationships
  logs            OrderLog[]
}

model OrderLog {
  id          String    @id @default(uuid())
  orderId     String
  
  actorId     String?   // User ID. If null, it's System/Bot
  actorName   String    // "Bot", "Rahul (Agent)" - Denormalized for history speed
  actorRole   String    // "BOT", "AGENT", "OWNER"
  
  action      OrderChangeType
  metadata    Json?     // { from: "BOT_DETECTED", to: "CONFIRMED" }
  
  timestamp   DateTime  @default(now())
  
  order       Order     @relation(fields: [orderId], references: [id])
  
  @@index([orderId])
  @@index([timestamp])
}
```

---

## 3. Backend Architecture (Event-Driven)

### 3.1 Status State Machine (Strict Transitions)
The backend will enforce the following valid transitions. Any other attempt throws `400 Bad Request`.

| Current State | Valid Next States | Triggered By | Logic |
|:---|:---|:---|:---|
| `BOT_DETECTED` | `PENDING_ACTION` | Bot | Text analysis confirms order. |
| `PENDING_ACTION` | `CONFIRMED` | **Agent Only** | "Accept" button click. **LOCKS ORDER**. |
| `PENDING_ACTION` | `REJECTED` | Agent | "Reject" button. |
| `CONFIRMED` | `PREPARING` | Agent/Kitchen | Work started. |
| `PREPARING` | `READY` | Agent | Work finished. |
| `READY` | `DELIVERED`, `SHIPPED` | Agent/Logistics | Handoff. |
| `*` | `CANCELLED` | Agent/Owner | Emergency halt. |

### 3.2 Locking Strategy (Concurrency)
To prevent two agents from accepting the same order:
1. **Optimistic Concurrency Control (OCC):**
   - Frontend sends `orderId` AND `version`.
   - Backend: `UPDATE Order SET status='CONFIRMED', version=version+1 WHERE id={id} AND version={version}`.
   - If `count === 0`, it means another agent already modified it. Backend throws `409 Conflict`. Frontend allows user to refresh.

### 3.3 Event Emitter & Notifications
Use a specialized `OrderEventManager` class.

```typescript
// Pseudocode
class OrderEventManager {
  async emitStatusChange(order, oldStatus, newStatus, actor) {
    // 1. Log to DB
    await prisma.orderLog.create({ ... });
    
    // 2. Emit to Socket Room "company:{id}"
    io.to(`company:${order.companyId}`).emit('order_update', { 
      orderId: order.id, 
      status: newStatus 
    });
    
    // 3. Notify Owner (If critical)
    if (newStatus === 'PENDING_ACTION') {
      NotificationService.notifyAdmins(order.companyId, "New Order", "Review needed");
    }
  }
}
```

---

## 4. Frontend UX/UI Strategy

### 4.1 "New Orders" Tab (The Queue)
- **Filter:** `status === 'PENDING_ACTION'`
- **UI:** High visibility cards.
- **Action:** Two giant buttons: [ACCEPT] [REJECT].
- **Pulse Effect:** Real-time arrival of new cards via Socket.

### 4.2 Timeline View (Drawer/Modal)
When clicking an order, open a side drawer showing the **Audit Log**:
- `10:00 AM` - 🤖 **Bot** detected potential order.
- `10:01 AM` - 👤 **Rahul (Agent)** accepted order.
- `10:15 AM` - 👨‍🍳 **Kitchen** marked as Preparing.
- `10:30 AM` - 👤 **Rahul** added note: "Customer wants extra spicy".

### 4.3 History Page
- **Filter:** `status IN ['DELIVERED', 'CANCELLED', 'REJECTED', 'ARCHIVED']`
- **Soft Delete:** Owner sees "Archive" button. Moves status to `ARCHIVED`.
- **Search:** Elastic/Fuzzy search on Customer Name or Order items.

---

## 5. Implementation Roadmap

1.  **Phase 1 (Schema):** Update `schema.prisma` with `OrderLog` and new Enums. Run Migration.
2.  **Phase 2 (Backend Services):** Implement `OrderWorkflowService` with strict transitions and logging.
3.  **Phase 3 (APIs):** Update `orders.routes.ts` to use the workflow service.
4.  **Phase 4 (Frontend):** Build the "Timeline" component and integrate "Accept" flow with optimistic locking handling.

This architecture ensures you are ready for 1,000+ concurrently active orders.
