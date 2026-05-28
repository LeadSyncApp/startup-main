#!/usr/bin/env node
// Codemod scaffold (CommonJS): safe replacement of common Tailwind light classes with semantic utilities.
// Usage: node replace-tailwind-classes.cjs --dry

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const REPLACEMENTS = [
  { regex: /\bbg-white\b/g, replace: 'bg-app-surface' },
  { regex: /\bbg-slate-50\b/g, replace: 'bg-app-bg' },
  { regex: /\btext-slate-900\b/g, replace: 'text-app-text' },
  { regex: /\btext-slate-600\b/g, replace: 'text-app-muted' },
  { regex: /\bborder-slate-100\b/g, replace: 'border-app' },
  { regex: /\bborder-slate-200\b/g, replace: 'border-app' }
];

const args = process.argv.slice(2);
const dry = args.includes('--dry');

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  let out = src;
  REPLACEMENTS.forEach(r => {
    out = out.replace(r.regex, r.replace);
  });
  if (out !== src) {
    console.log((dry ? '[DRY] ' : '[MOD] ') + file);
    if (!dry) fs.writeFileSync(file, out, 'utf8');
  }
}

function run() {
  const files = glob.sync('src/**/*.{js,ts,jsx,tsx}', { cwd: process.cwd(), absolute: true });
  files.forEach(processFile);
  console.log('Done. Dry run:', dry);
}

run();
