# Fix for LeadSync CRM pendingOrderState Database Mismatch

## Problem
The Prisma schema includes `pendingOrderState` fields in the Lead model, but the database doesn't have these columns, causing P2022 errors.

## Solution
Created migration: `20260329151648_add_pending_order_state_fields`

## Migration Details
- Adds `PendingOrderState` enum with values: NONE, PENDING_APPROVAL, CLAIMED_FOR_APPROVAL
- Adds 6 new columns to Lead table:
  - `pendingOrderState` (enum, default: NONE)
  - `pendingOrderId` (text, nullable)
  - `pendingOrderClaimedById` (text, nullable)
  - `pendingOrderClaimedAt` (timestamp, nullable)
  - `pendingOrderSummary` (text, nullable)
  - `pendingOrderAmount` (double precision, nullable)
- Adds indexes for performance

## Steps to Apply Fix

### 1. Apply Migration to Database
```bash
cd leadsync-backend
npx prisma migrate deploy
```

### 2. If Migration Fails Due to Conflicts
If you get migration conflicts, you may need to reset:

```bash
# Backup current database first
# Then reset and reapply all migrations
npx prisma migrate reset --force
npx prisma migrate deploy
```

### 3. Regenerate Prisma Client
```bash
npx prisma generate
```

### 4. Redeploy Backend
The Railway deployment needs to use the updated Prisma client. The migration will be applied automatically during deployment if DATABASE_URL is properly configured.

## Verification
After deployment, the Telegram order flow should work without P2022 errors. The Lead table will contain the new `pendingOrderState` fields.

## Files Modified
- `prisma/migrations/20260329151648_add_pending_order_state_fields/migration.sql` (new)
- Prisma client regenerated

## Backward Compatibility
- All new fields have sensible defaults
- Existing functionality remains unchanged
- No breaking changes to existing APIs
