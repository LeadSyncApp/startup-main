# LeadSync Order Workflow

## Updated Workflow Implementation

### 1. User Places Order
- **Status**: `OrderStatus.NEW`
- **Visibility**: Only appears in:
  - Conversation page (for the specific conversation)
  - New Order Arrivals page (for agents to claim)
- **Orders Page**: Hidden (NEW orders excluded)

### 2. Agent Claims Order
- **Status**: Still `OrderStatus.NEW` (unchanged)
- **Visibility**: 
  - Remains in conversation page
  - Removed from New Order Arrivals (claimed by agent)
  - Agent can interact with user in conversation
- **Orders Page**: Still hidden

### 3. Agent-User Interaction
- **Status**: Still `OrderStatus.NEW`
- **Process**: Agent interacts with user to confirm details, answer questions, etc.
- **Bot Support**: Bot can assist with order details in conversation
- **Orders Page**: Still hidden

### 4. Agent Manual Confirmation
- **Endpoint**: `POST /api/new-order-arrivals/confirm-order/:orderId`
- **Status**: Changes to `OrderStatus.PENDING`
- **Visibility**: 
  - Removed from conversation workflow
  - Appears in Orders page (active view)
- **Process**: Agent clicks "Confirm Order" button after user confirmation

## API Endpoints

### Claim Order
```
POST /api/new-order-arrivals/claim-order/:orderId
```
- Assigns order to agent
- Keeps status as `NEW`
- Order stays in conversation for interaction

### Manual Confirmation
```
POST /api/new-order-arrivals/confirm-order/:orderId
```
- Changes status from `NEW` to `PENDING`
- Moves order to Orders page
- Emits socket events for UI updates

## Status Flow

```
NEW (claimed) -> NEW (interaction) -> PENDING (confirmed) -> PROCESSING -> ...
```

## Key Differences from Previous Workflow

1. **Claim doesn't move to Orders page**: Orders stay in conversation until manual confirmation
2. **Manual confirmation required**: Agent must explicitly confirm after user interaction
3. **Clear separation**: NEW = conversation workflow, PENDING = Orders page workflow
4. **Better user experience**: Agents can interact with customers before order enters main workflow

## Frontend Integration

Frontend should:
1. Show "Claim" button for NEW orders in New Order Arrivals
2. Show order details in conversation after claiming
3. Show "Confirm Order" button in conversation after user confirms
4. Remove order from conversation when confirmed
5. Add order to Orders page when status changes to PENDING
