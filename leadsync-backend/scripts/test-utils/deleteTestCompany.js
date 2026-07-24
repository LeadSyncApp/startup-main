/**
 * Test Company Teardown Helper
 * 
 * Removes a test company (isTest: true) and all associated data.
 * REFUSES to delete a company where isTest is not true.
 * 
 * Usage:
 *   node scripts/test-utils/deleteTestCompany.js <companyId>
 */

require('dotenv').config();
const { Client } = require('pg');

async function deleteTestCompany(companyId) {
  if (!companyId) {
    console.error('Usage: node deleteTestCompany.js <companyId>');
    process.exit(1);
  }

  const rawUrl = process.env.DATABASE_URL;
  const urlObj = new URL(rawUrl);
  urlObj.searchParams.delete('sslmode');

  const client = new Client({
    connectionString: urlObj.toString(),
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  // SAFETY: Verify isTest is true before proceeding
  const check = await client.query(
    'SELECT id, name, "isTest" FROM "Company" WHERE id = $1',
    [companyId]
  );

  if (check.rows.length === 0) {
    console.error('ERROR: Company not found:', companyId);
    await client.end();
    process.exit(1);
  }

  if (!check.rows[0].isTest) {
    console.error('BLOCKED: Refusing to delete company where isTest is not true.');
    console.error('Company:', check.rows[0].name, '(' + check.rows[0].id + ')');
    await client.end();
    process.exit(1);
  }

  console.log('Deleting test company:', check.rows[0].name, '(' + companyId + ')');

  // Delete in dependency order (matches company.routes.ts purge logic)
  const tables = [
    '"Message"',
    '"ConversationActivity"',
    '"OrderLog"',
    '"OrderItem"',
    '"Invoice"',
    '"Order"',
    '"Conversation"',
    '"Lead"',
    '"Notification"',
    '"Invitation"',
    '"AgentFeedPost"',
    '"User"',
    '"MerchantFile"',
    '"BotKnowledge"',
    '"AutomationRule"',
    '"AutomationLog"',
    '"NotificationTemplate"',
    '"CustomFieldDefinition"',
    '"Broadcast"',
    '"CompanyAnalyticsRollup"',
    '"IncomingWebhook"',
    '"ConversationalRule"',
    '"ConversationalRuleLog"',
    '"RuleDecisionLog"',
    '"KnowledgeChunk"',
    '"RuleGroup"',
    '"BotConfiguration"',
    '"AutoReplyRule"',
    '"AutoReplyLog"',
    '"ClaimLog"',
    '"ProductFieldDefinition"',
  ];

  for (const table of tables) {
    try {
      const res = await client.query(`DELETE FROM ${table} WHERE "companyId" = $1`, [companyId]);
      if (res.rowCount > 0) {
        console.log(`  Deleted ${res.rowCount} row(s) from ${table}`);
      }
    } catch (e) {
      // Table may not exist or may not have companyId column — skip silently
    }
  }

  // Finally delete the Company itself
  await client.query('DELETE FROM "Company" WHERE id = $1', [companyId]);
  console.log('Company deleted:', companyId);

  await client.end();
}

const companyId = process.argv[2];
deleteTestCompany(companyId).catch(e => { console.error('FATAL:', e.message); process.exit(1); });
