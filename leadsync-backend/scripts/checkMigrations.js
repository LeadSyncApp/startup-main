const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Check migration SQL files for any Message table references
const migrationsDir = path.join(__dirname, "..", "prisma", "migrations");
console.log("=== MIGRATION FILES CHECKING FOR Message TABLE ===");

function scanDir(dir) {
  if (!fs.existsSync(dir)) { console.log("No migrations directory found"); return; }
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = path.join(dir, entry.name);
      const sqlFiles = fs.readdirSync(subDir).filter(f => f.endsWith(".sql"));
      for (const sqlFile of sqlFiles) {
        const content = fs.readFileSync(path.join(subDir, sqlFile), "utf8");
        // Check if this migration creates or alters the Message table
        if (content.includes("Message") || content.includes("message")) {
          const lines = content.split("\n").filter(l => l.toLowerCase().includes("message"));
          console.log(`\n--- ${entry.name}/${sqlFile} ---`);
          lines.forEach(l => console.log(l.substring(0, 200)));
        }
      }
    }
  }
}

scanDir(migrationsDir);

// Check for seed files
console.log("\n=== SEED/SCRIPT FILES ===");
for (const f of ["prisma/seed.ts", "prisma/seed.js", "scripts/seed.ts", "scripts/seed.js"]) {
  const fullPath = path.join(__dirname, "..", f);
  if (fs.existsSync(fullPath)) {
    console.log(`Found: ${f}`);
    const content = fs.readFileSync(fullPath, "utf8");
    const msgLines = content.split("\n").filter(l => l.toLowerCase().includes("message"));
    msgLines.forEach(l => console.log(`  ${l.trim().substring(0, 120)}`));
  }
}

// Try git log for recent schema changes
try {
  console.log("\n=== GIT LOG FOR MESSAGE MODEL CHANGES ===");
  const log = execSync('git log --all --oneline -- prisma/schema.prisma', { cwd: path.join(__dirname, ".."), maxBuffer: 1024 * 1024 }).toString();
  console.log(log);
} catch(e) {
  console.log("Git not available or not a repo:", e.message);
}

console.log("\n=== DONE ===");