# LeadSync CRM Privacy & Assignment# Unified Order Workflow Implementation - Test Guide

## Overview
This guide provides comprehensive testing scenarios for the new unified New Order Arrivals workflow that ensures ALL incoming orders follow the same claim-first process regardless of customer history.

## Core Implementation Changes

### Backend Changes
1. **NewOrderArrival Service** (`src/services/newOrderArrival.service.ts`)
   - Universal intake for all orders
   - Customer history tracking
   - Claim-first assignment logic
   - Historical ownership preservation

2. **Order Parser Updates** (`src/services/orderParser.service.ts`)
   - Routes ALL orders through New Order Arrivals
   - Removed direct order creation bypass
   - Unified notification system

3. **Conversation Gating** (`src/routes/conversations.routes.ts`)
   - Excludes unclaimed NEW orders from conversation list
   - Enforces claim-before-conversation visibility

4. **New API Routes** (`src/routes/newOrderArrivals.routes.ts`)
   - GET `/api/newOrderArrivals` - Fetch unclaimed orders
   - POST `/api/newOrderArrivals/:id/claim` - Claim orders
   - GET `/api/newOrderArrivals/claimed` - View claimed orders

5. **Schema Updates** (`prisma/schema.prisma`)
   - Added `deletedAt` to Lead model for soft delete
   - Enhanced indexing for performance
- Agent B sees "Claimed by Agent A" or cannot see the order at all
- Backend shows `pendingOrderClaimedById = Agent A's ID`

### 3. Unassigned Order Claiming Test
**Objective**: Verify proper claiming workflow for unassigned orders

**Steps**:
1. Create order without assigned conversation (or unassigned conversation)
2. Login as Agent A
3. Go to Leads page → Pending Approval filter
4. Verify "Claim Order" button is enabled
5. Click "Claim Order"
6. Verify order shows as "Claimed by Agent A"
7. Login as Agent B
8. Verify Agent B cannot claim the same order

**Expected Results**:
- Claim button only enabled for unassigned orders
- After claiming, button shows "View Order" for owner, disabled for others
- Backend prevents double claiming with 409 error

### 4. Admin Override Test
**Objective**: Verify admins can reassign any order

**Steps**:
1. Login as Admin/Owner
2. Find order claimed by Agent A
3. Verify admin can access order details
4. Verify admin can reassign to Agent B
5. Verify Agent B now has access

**Expected Results**:
- Admin bypasses all assignment restrictions
- Can reassign orders between agents
- Full visibility into all conversations and orders

### 5. Real-time Updates Test
**Objective**: Verify socket events update UI correctly

**Steps**:
1. Login as Agent A and Agent B simultaneously
2. Agent A claims an unassigned conversation
3. Verify conversation disappears from Agent B's list immediately
4. Agent A unassigns the conversation
5. Verify conversation reappears in Agent B's list
6. Test with pending order claiming/unclaiming

**Expected Results**:
- `conversation_removed` event removes conversations from other agents
- `conversation_added` event adds conversations back when unassigned
- `lead_updated` event updates pending order status in real-time

## API Testing Commands

### Test Conversation Access
```bash
# Agent trying to access another agent's conversation
curl -H "Authorization: Bearer AGENT_B_TOKEN" \
     http://localhost:3001/api/conversations/AGENT_A_CONVERSATION_ID/messages
# Expected: 403 Forbidden

# Agent accessing their own conversation
curl -H "Authorization: Bearer AGENT_A_TOKEN" \
     http://localhost:3001/api/conversations/AGENT_A_CONVERSATION_ID/messages
# Expected: 200 OK
```

### Test Order Claiming
```bash
# Agent trying to claim already claimed order
curl -X POST -H "Authorization: Bearer AGENT_B_TOKEN" \
     http://localhost:3001/api/leads/LEAD_ID/claim-pending-order
# Expected: 409 Conflict

# Admin claiming any order
curl -X POST -H "Authorization: Bearer ADMIN_TOKEN" \
     http://localhost:3001/api/leads/LEAD_ID/claim-pending-order
# Expected: 200 OK
```

### Test Lead Listing
```bash
# Agent leads list (should only show their assignments + unassigned)
curl -H "Authorization: Bearer AGENT_TOKEN" \
     http://localhost:3001/api/leads
# Check: canCurrentUserClaim, isPendingOrderOwnedByCurrentAgent fields

# Admin leads list (should show everything)
curl -H "Authorization: Bearer ADMIN_TOKEN" \
     http://localhost:3001/api/leads
```

## Database Verification Queries

```sql
-- Check conversation assignments
SELECT id, assignedToId, status FROM "Conversation" WHERE companyId = 'YOUR_COMPANY_ID';

-- Check pending order assignments
SELECT id, pendingOrderState, pendingOrderClaimedById FROM "Lead" 
WHERE pendingOrderState != 'NONE';

-- Verify order creation respects conversation assignment
SELECT o.id, o.conversationId, c.assignedToId, l.pendingOrderClaimedById
FROM "Order" o
JOIN "Conversation" c ON o.conversationId = c.id
JOIN "Lead" l ON o.leadId = l.id
WHERE o.companyId = 'YOUR_COMPANY_ID';
```

## Frontend UI Verification

### Conversation List
- [ ] Assignment badges show "Assigned to [Agent Name]"
- [ ] Unassigned conversations show no badge
- [ ] Real-time removal when claimed by others

### Leads Page
- [ ] Pending approval filter works correctly
- [ ] Claim button respects permissions
- [ ] Order amount and summary display
- [ ] Agent assignment indicators

### Permission Indicators
- [ ] Disabled buttons for unassigned items
- [ ] Proper error messages for permission violations
- [ ] Admin override capabilities visible

## Performance Considerations

1. **Database Indexes**: Verify indexes exist on assignment fields
2. **Socket Performance**: Monitor real-time update latency
3. **Frontend Rendering**: Check for unnecessary re-renders
4. **API Response Times**: Ensure permission checks don't slow requests

## Rollback Plan

If issues arise, rollback changes in this order:
1. Frontend UI changes (revert LeadsTable.tsx, Conversations.tsx)
2. Backend permission logic (revert leads.routes.ts changes)
3. Order assignment logic (revert orders.routes.ts changes)
4. Test basic functionality before reapplying fixes

## Success Metrics

- ✅ No agent can access another agent's conversations
- ✅ AI-detected orders stay with conversation handler
- ✅ Pending approval workflow respects assignments
- ✅ Real-time updates work across multiple clients
- ✅ Admin/Owner maintains full access
- ✅ Frontend UI reflects permission states correctly
- ✅ No performance degradation
- ✅ All existing functionality preserved
