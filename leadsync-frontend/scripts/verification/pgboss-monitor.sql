-- 1. Force-run a mock CLEANUP_IDEMPOTENCY job
-- Replace 'cleanup:idempotency' if your job name constant differs.
INSERT INTO pgboss.job (name, data, state, retrylimit, createdon)
VALUES ('cleanup:idempotency', '{"mock": true, "timestamp": ' || extract(epoch from now())::text || '}', 'created', 0, now());

-- 2. Monitor job state transitions and execution duration
SELECT 
    id, 
    name, 
    state, 
    createdon, 
    startedon, 
    completedon, 
    failedon, 
    retrycount,
    output,
    (completedon - startedon) AS duration
FROM pgboss.job 
WHERE name = 'cleanup:idempotency'
ORDER BY createdon DESC
LIMIT 10;

-- 3. Check for database locks and contention
-- This monitors active processes and table/row level locks in the pgboss schema
SELECT 
    a.pid,
    a.query,
    a.state,
    l.mode,
    l.locktype,
    l.relation::regclass AS locked_table
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE l.relation::regclass::text LIKE 'pgboss.%';
