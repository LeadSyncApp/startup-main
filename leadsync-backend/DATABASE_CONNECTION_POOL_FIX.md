# Database Connection Pool Exhaustion - Fix Guide

## Problem Summary
Your backend is experiencing connection pool exhaustion errors:
```
FATAL: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15
```

## Root Cause
Three concurrent background services are competing for database connections:

1. **Telegram Polling** (`telegram.polling.ts`) - Every 1.5 seconds
2. **Telegram Heartbeat** (`telegramSelector.service.ts`) - Every 10 seconds  
3. **Automation Rules** (`automation.service.ts`) - Every 15 minutes

Combined, these services can saturate the 15-connection pool quickly.

---

## Solutions Applied

### ✅ 1. Added Retry Logic with Exponential Backoff
**File**: `src/lib/retry-utils.ts` (NEW)
- Retries failed queries with exponential backoff
- Handles `EMAXCONNSESSION` errors gracefully
- Configurable max attempts and delays

### ✅ 2. Increased Poll Intervals
**File**: `src/services/messaging/telegram.polling.ts`
- **Changed**: Poll interval from 1.5 seconds → **5 seconds**
- Added retry logic for `findMany()` queries
- Better error handling for pool exhaustion

**File**: `src/services/messaging/telegramSelector.service.ts`
- **Changed**: Heartbeat interval from 10 seconds → **15 seconds**
- Added retry logic for lease refresh
- Gracefully skips failed lease updates

### ✅ 3. Enhanced Automation Service
**File**: `src/services/workflow/automation.service.ts`
- Added retry logic to all database queries
- Better error detection for connection pool issues
- Continues gracefully if queries fail

---

## Next Steps: Increase Connection Pool Size

### For Railway Deployment
Edit your `railway.toml` or the DATABASE_URL environment variable:

**Before:**
```
DATABASE_URL=postgresql://user:pass@host/db?schema=public&directUrl=...
```

**After:**
```
DATABASE_URL=postgresql://user:pass@host/db?schema=public&pool_size=40&statement_cache_size=0&directUrl=...
```

### For Local Development
Edit your `.env` file:
```bash
DATABASE_URL="postgresql://localhost:5432/leadsync_db?schema=public&pool_size=40&statement_cache_size=0"
```

### Recommended Pool Size Based on Load
- **Development**: `20-30` connections
- **Production (small)**: `40-50` connections
- **Production (large)**: `60-100` connections

---

## Testing the Fixes

### 1. Restart your backend service
```bash
npm run dev
# or for production
npm run build && npm start
```

### 2. Monitor logs for pool exhaustion
Watch for these messages:
- ✅ `Connection pool exhausted, backing off...` - Normal, will retry
- ✅ `⚠️ Database query failed (attempt N/N). Retrying...` - Exponential backoff active
- ❌ `FATAL: (EMAXCONNSESSION)` repeating - Pool size still too small

### 3. Verify no connection leaks
Check that error messages decrease over time as the system stabilizes.

---

## Configuration Reference

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `pool_size` | 40-50 | Max connections in pool |
| `statement_cache_size` | 0 | Disable statement caching (avoids per-statement limit issues) |
| `connect_timeout` | 10 | Connection timeout in seconds |

---

## Monitoring

### Check Current Load
Monitor these services in your logs:
```
[Telegram Polling]     - Should see updates every ~5 seconds
[Telegram Lease]       - Should see heartbeat every ~15 seconds  
[Automation]           - Should see evaluations every 15 minutes
```

### Key Metrics
- **Error Frequency**: Should decrease over time
- **Retry Messages**: Normal and expected, means backoff is working
- **Successful Queries**: Should increase as pool stabilizes

---

## If Problems Persist

1. **Further increase pool_size** → Try 60-80 connections
2. **Add connection pooling** → Use PgBouncer in front of PostgreSQL
3. **Separate read replicas** → Move polling queries to read-only connections
4. **Reduce polling frequency** → Only if other solutions fail

---

## Files Modified
- ✅ `src/lib/retry-utils.ts` (NEW)
- ✅ `src/services/messaging/telegram.polling.ts`
- ✅ `src/services/messaging/telegramSelector.service.ts`
- ✅ `src/services/workflow/automation.service.ts`
