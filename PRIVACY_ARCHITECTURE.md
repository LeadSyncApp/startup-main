# 🔐 Privacy-First Architecture Redesign

## 1️⃣ Strict Isolation Model (The "Need-to-Know" Principle)

Current system allows any agent in a company to see all conversations.
**New System** enforcing strict privacy boundaries:

| Actor | Unclaimed Leads | My Claims | Other Agents' Claims |
| :--- | :--- | :--- | :--- |
| **Agent** | ✅ Visible | ✅ Visible | ❌ **HIDDEN** (403 Forbidden) |
| **Admin/Owner** | ✅ Visible | ✅ Visible | ✅ Visible |

---

## 2️⃣ Database Security (Supabase RLS)

Even if the backend sends data, the database must reject unauthorized queries.

### **RLS Policy Design**

#### **1. Conversations Table**
```sql
-- Enable RLS
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;

-- Policy: Owners/Admins see ALL
CREATE POLICY "Admin All Access" ON "Conversation"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "User" 
    WHERE id = auth.uid() 
    AND role IN ('OWNER', 'ADMIN')
  )
);

-- Policy: Agents see UNCLAIMED or ASSIGNED TO SELF
CREATE POLICY "Agent Access" ON "Conversation"
FOR ALL
USING (
  assignedToId IS NULL 
  OR assignedToId = auth.uid()
);
```

#### **2. Messages & Orders Table**
```sql
-- Inherit access from Conversation
CREATE POLICY "Message Access" ON "Message"
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM "Conversation" c
    WHERE c.id = conversationId
    AND (
      c.assignedToId IS NULL 
      OR c.assignedToId = auth.uid()
      OR EXISTS (SELECT 1 FROM "User" u WHERE u.id = auth.uid() AND u.role IN ('OWNER', 'ADMIN'))
    )
  )
);
```

---

## 3️⃣ Real-Time Event Partitioning (Socket.io)

We replace the single `company:{id}` room with granular channels to prevent data leaks via WebSocket.

### **New Room Structure**
1.  **`company:{id}:admin`** → Receives ALL events. (Joined by Owners/Admins)
2.  **`company:{id}:unclaimed`** → Receives only events for `assignedToId: null`. (Joined by Agents)
3.  **`user:{id}`** → Receives events for conversations assigned specifically to this user.

### **Event Flow**
- **New Lead (Unclaimed)** → Emit to `company:{id}:unclaimed` + `company:{id}:admin`.
- **Agent A Claims Lead** →
    - Emit `conversation_removed` to `company:{id}:unclaimed`.
    - Emit `conversation_added` to `user:{A}`.
    - Emit `conversation_updated` to `company:{id}:admin`.
- **Message in Claimed Chat** → Emit only to `user:{A}` + `company:{id}:admin`.

---

## 4️⃣ Backend Middleware & Logic

### **Secure Fetch (`GET /conversations`)**
Modify the Prisma query to enforced filtering:

```typescript
const whereClause = {
  companyId,
  OR: [
    { assignedToId: null },       // Unclaimed
    { assignedToId: req.user.id } // My conversations
  ]
};

// If Admin/Owner, remove the OR clause to see everything.
if (req.user.role === 'ADMIN' || req.user.role === 'OWNER') {
  delete whereClause.OR;
}
```

### **Atomic Claiming (`PATCH /assign`)**
Prevent race conditions where two agents claim simultaneously.

```typescript
// 1. Atomic Update
const result = await prisma.conversation.updateMany({
  where: {
    id: conversationId,
    assignedToId: null // 🔒 CRITICAL: Only claim if currently null
  },
  data: {
    assignedToId: userId,
    status: 'ASSIGNED'
  }
});

if (result.count === 0) {
  throw new Error("Already claimed by another agent");
}
```

---

## 5️⃣ Performance Strategy

1.  **Composite Indexes**:
    - `@@index([companyId, assignedToId, status])` -> For fast filtering of "My Active Chats".
    - `@@index([companyId, assignedToId])` -> For the main list view.

2.  **Pagination w/ Cursors**:
    - Already implemented, but must ensure the Cursor follows the new `OR` logic efficiently. 
    - *Optimization*: Separate "Unclaimed" and "Mine" into two separate API calls or UI tabs if query performance drops, but for <1M records, single query is fine.
