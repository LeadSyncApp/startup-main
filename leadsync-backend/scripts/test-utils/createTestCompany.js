/**
 * Test Company Creation Helper
 * 
 * Creates a disposable company record marked with isTest: true.
 * Generates its own websiteWebhookSecret via crypto.randomBytes.
 * NEVER reuses or mutates an existing companyId.
 * 
 * Usage:
 *   node scripts/test-utils/createTestCompany.js
 * 
 * Output (stdout):
 *   COMPANY_ID=<uuid>
 *   SECRET=<hex>
 *   COMPANY_NAME=<name>
 */

require('dotenv').config();
const { Client } = require('pg');
const crypto = require('crypto');

async function createTestCompany() {
  const rawUrl = process.env.DATABASE_URL;
  const urlObj = new URL(rawUrl);
  urlObj.searchParams.delete('sslmode');

  const client = new Client({
    connectionString: urlObj.toString(),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  const suffix = crypto.randomBytes(4).toString('hex');
  const companyName = `[TEST] E2E Webhook Test ${suffix}`;
  const companyCode = `TEST-E2E-${suffix}`;
  const secret = crypto.randomBytes(32).toString('hex');

  const result = await client.query(
    `INSERT INTO "Company" (id, name, "companyCode", "isTest", "websiteWebhookSecret", "currencySymbol", "currencyCode", timezone, "updatedAt")
     VALUES (gen_random_uuid(), $1, $2, true, $3, '₹', 'INR', 'Asia/Kolkata', NOW())
     RETURNING id, name, "companyCode", "websiteWebhookSecret"`,
    [companyName, companyCode, secret]
  );

  const row = result.rows[0];
  console.log('COMPANY_ID=' + row.id);
  console.log('SECRET=' + row.websiteWebhookSecret);
  console.log('COMPANY_NAME=' + row.name);
  console.log('COMPANY_CODE=' + row.companyCode);

  await client.end();
  return row;
}

createTestCompany().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
