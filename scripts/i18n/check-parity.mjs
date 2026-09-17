#!/usr/bin/env node
/**
 * i18n coverage analyzer — checks dictionary key parity across fr/ar/en.
 * Usage: node scripts/i18n/check-parity.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", ".."); // elimtiyaz-website root
const DICT = join(ROOT, "src/lib/i18n/dictionary.ts");

const src = readFileSync(DICT, "utf8");

function extractBlock(startIdx) {
  let depth = 0,
    started = false;
  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === "{") {
      depth++;
      started = true;
    } else if (src[i] === "}") {
      depth--;
      if (started && depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  throw new Error("unbalanced braces");
}

// match dictionary keys:  "some.key.name":
const KEY_RE = /"([a-zA-Z0-9_.-]+)"\s*:/g;

function extractKeys(block) {
  const keys = [];
  let m;
  const re = new RegExp(KEY_RE.source, "g");
  while ((m = re.exec(block))) keys.push(m[1]);
  return keys;
}

const frStart = src.indexOf("const fr: Dict = {") + "const fr: Dict = ".length;
const arStart = src.indexOf("const ar: Dict = {") + "const ar: Dict = ".length;
const enStart = src.indexOf("const en: Dict = {") + "const en: Dict = ".length;
if (frStart < 20 || arStart < 20 || enStart < 20) {
  console.error("FATAL: could not locate locale blocks in dictionary.ts");
  process.exit(2);
}

const fr = extractKeys(extractBlock(frStart));
const ar = extractKeys(extractBlock(arStart));
const en = extractKeys(extractBlock(enStart));

const frSet = new Set(fr),
  arSet = new Set(ar),
  enSet = new Set(en);

console.log(`fr keys: ${fr.length} (unique ${frSet.size})`);
console.log(`ar keys: ${ar.length} (unique ${arSet.size})`);
console.log(`en keys: ${en.length} (unique ${enSet.size})`);

const missingInAr = [...frSet].filter((k) => !arSet.has(k));
const missingInEn = [...frSet].filter((k) => !enSet.has(k));
const arOnly = [...arSet].filter((k) => !frSet.has(k));
const enOnly = [...enSet].filter((k) => !frSet.has(k));
const dupFr = fr.length - frSet.size,
  dupAr = ar.length - arSet.size,
  dupEn = en.length - enSet.size;

console.log(`\nin fr but NOT ar (${missingInAr.length}):`);
missingInAr.forEach((k) => console.log(`  ${k}`));
console.log(`\nin fr but NOT en (${missingInEn.length}):`);
missingInEn.forEach((k) => console.log(`  ${k}`));
console.log(`\nin ar but NOT fr (${arOnly.length}):`);
arOnly.forEach((k) => console.log(`  ${k}`));
console.log(`\nin en but NOT fr (${enOnly.length}):`);
enOnly.forEach((k) => console.log(`  ${k}`));
console.log(`\nduplicate keys: fr=${dupFr} ar=${dupAr} en=${dupEn}`);

const bad =
  missingInAr.length || missingInEn.length || arOnly.length || enOnly.length || dupFr || dupAr || dupEn;
process.exit(bad ? 1 : 0);
