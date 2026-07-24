import dotenv from "dotenv";
dotenv.config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { Client } from "pg";

async function purgePgBossJobs() {
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log("Purging all rows from pgboss.job table...");
  const res = await client.query("DELETE FROM pgboss.job;");
  console.log(`✅ Deleted ${res.rowCount} rows from pgboss.job.`);

  await client.end();
}

purgePgBossJobs().catch(err => {
  console.error("Error purging pgboss jobs:", err);
  process.exit(1);
});
