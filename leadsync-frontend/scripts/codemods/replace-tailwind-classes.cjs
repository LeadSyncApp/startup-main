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
  { regex: /\bborder-app\b(?!-)/g, replace: 'border-app-border' },

  // Accent tints that are too bright in dark mode
  // Normalize common blue/indigo/cyan/sky "tint" utilities to semantic app primary.
  { regex: /\bhover:bg-(?:blue|indigo|cyan|sky)-(?:50|100|200)(?:\/(\d{1,3}))?\b/g, replace: 'hover:bg-app-primary/15' },
  { regex: /\bbg-(?:blue|indigo|cyan|sky)-(?:50|100|200)(?:\/(\d{1,3}))?\b/g, replace: 'bg-app-primary/10' },
  { regex: /\bhover:text-(?:blue|indigo|cyan|sky)-(?:400|500|600|700|800|900)\b/g, replace: 'hover:text-app-primary-strong' },
  { regex: /\btext-(?:blue|indigo|cyan|sky)-(?:400|500|600|700|800|900)\b/g, replace: 'text-app-primary' },
  { regex: /\bhover:border-(?:blue|indigo|cyan|sky)-(?:50|100|200|300)(?:\/(\d{1,3}))?\b/g, replace: 'hover:border-app-primary/30' },
  { regex: /\bborder-(?:blue|indigo|cyan|sky)-(?:50|100|200|300)(?:\/(\d{1,3}))?\b/g, replace: 'border-app-primary/20' },
  { regex: /\bring-(?:blue|indigo|cyan|sky)-(?:100|200|300|400)(?:\/(\d{1,3}))?\b/g, replace: 'ring-app-primary/25' },
  { regex: /\bfocus:ring-(?:blue|indigo|cyan|sky)-(?:100|200|300|400)(?:\/(\d{1,3}))?\b/g, replace: 'focus:ring-app-primary/25' },

  { regex: /\bfrom-(?:blue|indigo|cyan|sky)-(?:50|100|200)(?:\/(\d{1,3}))?\b/g, replace: 'from-app-primary/15' },
  { regex: /\bto-(?:blue|indigo|cyan|sky)-(?:50|100|200)(?:\/(\d{1,3}))?\b/g, replace: 'to-app-primary/10' },
  { regex: /\bvia-(?:blue|indigo|cyan|sky)-(?:50|100|200)(?:\/(\d{1,3}))?\b/g, replace: 'via-app-primary/12' },

  // Accent (hex) cleanup for common brand blues
  { regex: /bg-\[#0052CC\]/gi, replace: 'bg-app-primary' },
  { regex: /hover:bg-\[#0844A3\]/gi, replace: 'hover:bg-app-primary-strong' },
  { regex: /text-\[#0052CC\]/gi, replace: 'text-app-primary' },
  { regex: /border-\[#0052CC\]/gi, replace: 'border-app-primary' },
  { regex: /ring-\[#0052CC\]/gi, replace: 'ring-app-primary' },
  { regex: /focus:border-\[#0052CC\]/gi, replace: 'focus:border-app-primary' },
  { regex: /focus:ring-\[#0052CC\]/gi, replace: 'focus:ring-app-primary' },
  { regex: /hover:text-\[#003D99\]/gi, replace: 'hover:text-app-primary-strong' },
  { regex: /text-\[#2563EB\]/gi, replace: 'text-app-primary' },
  { regex: /bg-\[#EEF4FF\]/gi, replace: 'bg-app-primary/10' },
  { regex: /text-\[#0047CC\]/gi, replace: 'text-app-primary-strong' },

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
