const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  // 1. ProductFieldDefinition for this company
  const fields = await prisma.$queryRawUnsafe(`
    SELECT id, "fieldName", "fieldType", "appliesTo", options
    FROM "ProductFieldDefinition"
    WHERE "companyId" = '3102a85e-1798-45bb-b6c5-d94ea436f775'
  `);
  console.log("=== ProductFieldDefinition fieldName values ===");
  for (const f of fields) {
    console.log(`  fieldName="${f.fieldName}"  fieldType="${f.fieldType}"  appliesTo="${f.appliesTo}"`);
  }

  // 2. cotton pants customFieldValues
  const products = await prisma.$queryRawUnsafe(`
    SELECT id, name, "customFieldValues"
    FROM "InventoryProduct"
    WHERE "companyId" = '3102a85e-1798-45bb-b6c5-d94ea436f775'
    AND name ILIKE '%pant%'
  `);
  console.log("\n=== InventoryProduct customFieldValues ===");
  for (const p of products) {
    console.log(`  name="${p.name}"  customFieldValues keys: ${JSON.stringify(Object.keys(p.customFieldValues || {}))}`);
    console.log(`  full: ${JSON.stringify(p.customFieldValues)}`);
  }

  // 3. All products with customFieldValues for this company
  const all = await prisma.$queryRawUnsafe(`
    SELECT id, name, "customFieldValues"
    FROM "InventoryProduct"
    WHERE "companyId" = '3102a85e-1798-45bb-b6c5-d94ea436f775'
    AND "customFieldValues" IS NOT NULL
  `);
  console.log("\n=== ALL products with customFieldValues ===");
  for (const p of all) {
    console.log(`  name="${p.name}"  keys: ${JSON.stringify(Object.keys(p.customFieldValues || {}))}`);
  }

  await prisma.$disconnect();
})();
