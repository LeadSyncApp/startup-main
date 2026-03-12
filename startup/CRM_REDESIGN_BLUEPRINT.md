# 🏗️ LeadSync Intelligent CRM - Architecture Redesign

**Objective**: Transform from a simple chatbot to a real-time, AI-powered Business CRM.
**Constraints**: Free Tier (Railway/Supabase), Groq AI, Node.js/React.

---

## 1️⃣ Core Architecture: "The Intelligence Layer"

To achieve instant responses and smart prioritization without paid vector DBs, we will implement a lightweight **Metadata-Driven Architecture**.

### 🧠 A. AI Context Strategy (Solving Latency)
**Problem**: Sending 50 messages to AI slows it down and confuses it.
**Solution**: **Rolling Summary Window**.
- **Mechanism**:
  - We NEVER send the full history to the AI.
  - We maintain a `summary` field in the `Conversation` table.
  - **Background Job**: Every 10 messages, a lightweight Groq (Llama-8b) call runs: *"Summarize these 10 messages into 3 bullet points containing key facts (orders, preferences, name)."*
  - **Prompt Structure**: `System Prompt` + `Current Summary` + `Last 5 Messages`.
- **Result**: Constant O(1) token usage regardless of conversation length. < 300ms latency.

---

## 2️⃣ Database Schema Upgrades (The Foundation)

We need to track *value*, not just text.

### `Lead` Table Enhancements
- `totalSpend` (Float): Real-time revenue tracker.
- `orderCount` (Int): To detect repeat customers.
- `segment` (Enum): `VIP`, `NEW`, `CHURN_RISK`, `REGULAR`.
- `lastActiveAt` (DateTime): For retention heatmaps.

### `Conversation` Table Enhancements
- `summary` (Text): The AI memory block.
- `sentimentScore` (Int): -10 (Angry) to +10 (Happy).
- `intent` (Enum): `BROWSING`, `ORDERING`, `SUPPORT`, `COMPLAINT`.

### `Order` Table Enhancements
- `priorityScore` (Int): Calculated field for sorting.
- `predictedValue` (Float): AI guess of order value before manual entry.
- `urgency` (Boolean): True if "ASAP" or "Emergency" detected.

---

## 3️⃣ The Priority Algorithm (Scoring Microservice)

Every time a message arrives, we run a synchronous **Score Calculation**:

```typescript
function calculatePriority(lead, order, message) {
    let score = 0;
    
    // 1. Monetary Value (Weighted 50%)
    score += (order.amount || order.predictedValue || 0) * 0.1;
    
    // 2. Customer Loyalty
    if (lead.orderCount > 5) score += 20; // VIP
    if (lead.totalSpend > 5000) score += 50; // High Roller
    
    // 3. Urgency Keywords
    if (message.match(/urgent|wrong|missing|late/i)) score += 40;
    
    // 4. Time Decay (Boost older unread messages)
    score += (minutesSinceLastMessage * 1);
    
    return score;
}
```

---

## 4️⃣ Real-Time Dashboard (Frontend Redesign)

The "Orders" page will be replaced by a **Live Operations Center**.

### 📌 Sections (Kanban Style)
1.  **🚨 Red Alert (Score > 80)**: Complaints, High-value orders, Urgent queries.
2.  **🟡 Active Orders (Score 40-80)**: Standard new orders needing confirmation.
3.  **🟢 Processing**: Confirmed orders in preparation.
4.  **⚪ Inquiry**: Casual browsing (Low priority).

### ⚡ Updates
- Use **Supabase Realtime** or Socket.io to re-sort the list instantly when a score changes.
- **No Refreshing**: The UI must be fully reactive.

---

## 5️⃣ Analytics & Delivery Page

A dedicated "Shop Owner View" (Read-Only access possible).
- **KPIS**:
  - `Conversion Rate`: Orders / Leads.
  - `AI Resolution %`: how many chats didn't need Human Mode.
  - `Missed Revenue`: Value of "Abandoned" conversations.

---

## 🚀 Implementation Roadmap

1.  **Phase 1: Database Migration**: Add scoring, summary, and segment columns.
2.  **Phase 2: Intelligence Service**: Implement the scoring logic and summary background jobs.
3.  **Phase 3: Operational Dashboard**: Build the React Priority UI.
4.  **Phase 4: Analytics**: Build the Owner Report page.
