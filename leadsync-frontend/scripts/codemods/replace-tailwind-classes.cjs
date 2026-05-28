#!/usr/bin/env node
// Codemod scaffold (CommonJS): safe replacement of common Tailwind light classes with semantic utilities.
// Usage: node replace-tailwind-classes.cjs --dry

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const REPLACEMENTS = [
  { regex: /\bbg-white\b/g, replace: 'bg-app-surface' },
  { regex: /\bbg-slate-50\b/g, replace: 'bg-app-bg' },
  { regex: /\bbg-slate-100\b/g, replace: 'bg-app-bg-soft' },
  { regex: /\bbg-slate-200\b/g, replace: 'bg-app-bg-soft' },
  { regex: /\btext-slate-900\b/g, replace: 'text-app-text' },
  { regex: /\btext-slate-800\b/g, replace: 'text-app-text' },
  { regex: /\btext-slate-700\b/g, replace: 'text-app-text' },
  { regex: /\btext-slate-600\b/g, replace: 'text-app-muted' },
  { regex: /\btext-slate-500\b/g, replace: 'text-app-muted' },
  { regex: /\bborder-slate-100\b/g, replace: 'border-app-border' },
  { regex: /\bborder-slate-200\b/g, replace: 'border-app-border' },
  { regex: /\bborder-slate-300\b/g, replace: 'border-app-border-strong' },
  { regex: /\bborder-app\/(\d{1,3})\b/g, replace: 'border-app-border/$1' },

  { regex: /bg-\[#F8FAFC\]/gi, replace: 'bg-app-bg' },
  { regex: /bg-\[#F8F9FF\]/gi, replace: 'bg-app-bg' },
  { regex: /bg-\[#F8F9FB\]/gi, replace: 'bg-app-bg' },
  { regex: /bg-\[#F4F6F8\]/gi, replace: 'bg-app-bg' },
  { regex: /bg-\[#F1F5F9\]/gi, replace: 'bg-app-bg-soft' },

  { regex: /border-\[#D9DADC\]/gi, replace: 'border-app-border' },
  { regex: /border-\[#E2E8F0\]/gi, replace: 'border-app-border' },
  { regex: /border-\[#CBD5E1\]/gi, replace: 'border-app-border-strong' },
  { regex: /border-\[#F1F5F9\]/gi, replace: 'border-app-border' },

  { regex: /text-\[#1F2937\]/gi, replace: 'text-app-text' },
  { regex: /text-\[#1E293B\]/gi, replace: 'text-app-text' },
  { regex: /text-\[#0F172A\]/gi, replace: 'text-app-text' },
  { regex: /text-\[#6B7280\]/gi, replace: 'text-app-muted' },
  { regex: /text-\[#475569\]/gi, replace: 'text-app-muted' },
  { regex: /text-\[#64748B\]/gi, replace: 'text-app-muted' },
  { regex: /placeholder-\[#6B7280\]/gi, replace: 'placeholder-app-placeholder' },
  { regex: /placeholder-\[#94A3B8\]/gi, replace: 'placeholder-app-placeholder' },

  { regex: /bg-\[#D9DADC\]/gi, replace: 'bg-app-border' },
  { regex: /bg-\[#E2E8F0\]/gi, replace: 'bg-app-border' },
  { regex: /bg-\[#CBD5E1\]/gi, replace: 'bg-app-border-strong' },
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
