const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Read DATABASE_URL from .env
const envPath = path.join(__dirname, "..", ".env");
const envContent = fs.readFileSync(envPath, "utf8");
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!match) {
  console.error("DATABASE_URL not found in .env");
  process.exit(1);
}
const dbUrl = match[1].trim();

// Run the diff command
try {
  const sql = execSync(
    `npx prisma migrate diff --from-url="${dbUrl}" --to-schema-datamodel prisma/schema.prisma --script`,
    { cwd: path.join(__dirname, ".."), encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }
  );
  console.log(sql);
} catch (err) {
  console.log(err.stdout || "");
  console.error(err.stderr || err.message);
}