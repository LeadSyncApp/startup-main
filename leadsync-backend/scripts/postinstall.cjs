#!/usr/bin/env node
"use strict";

// Cross-platform postinstall wrapper.
// On Windows: runs conditional prisma generate (avoids EPERM DLL-lock issue).
// On non-Windows (Linux/Docker): silent no-op — the Dockerfile already runs
// `npx prisma generate` explicitly in both builder and runner stages.

if (process.platform !== "win32") {
  process.exit(0);
}

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const schemaPath = path.join(repoRoot, "prisma", "schema.prisma");
const generated = path.join(repoRoot, "node_modules", ".prisma", "client", "index.d.ts");

function run(command) {
  console.log(`[db-client] Running: ${command}`);
  execSync(command, { cwd: repoRoot, stdio: "inherit" });
}

try {
  if (!fs.existsSync(schemaPath)) {
    console.log("[db-client] Schema not found. Running prisma generate anyway.");
    run("npx prisma generate");
    return;
  }

  if (!fs.existsSync(generated)) {
    console.log("[db-client] No generated client found. Running prisma generate.");
    run("npx prisma generate");
    return;
  }

  const schemaTime = fs.statSync(schemaPath).mtimeMs;
  const genTime = fs.statSync(generated).mtimeMs;

  if (schemaTime > genTime) {
    console.log("[db-client] Schema is newer than generated client. Regenerating.");
    run("npx prisma generate");
  } else {
    console.log("[db-client] Generated client is up to date. Skipping.");
  }
} catch (err) {
  console.error("");
  console.error("[db-client] prisma generate failed. Common cause on Windows:");
  console.error("  Another node.exe is still holding the Prisma DLL open.");
  console.error("  Fix:  Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force");
  console.error("  Then re-run your npm script.");
  process.exit(1);
}
