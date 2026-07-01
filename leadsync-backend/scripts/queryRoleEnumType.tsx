import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  // Check the actual PG column type and enum values
  const colType = await p.$queryRawUnsafe(`
    SELECT data_type, udt_name, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'User' AND column_name = 'role'
  `);
  console.log("User.role column type:", JSON.stringify(colType, null, 2));
  
  const enumVals = await p.$queryRawUnsafe(`
    SELECT e.enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'Role'
  `);
  console.log("Role enum values in DB:", JSON.stringify(enumVals, null, 2));
  
  // Also check if there are any AGENT/ADMIN values hidden
  const allRoles = await p.$queryRawUnsafe('SELECT DISTINCT role FROM "User"');
  console.log("All distinct User.role values:", JSON.stringify(allRoles, null, 2));
  
  await p.$disconnect();
})();