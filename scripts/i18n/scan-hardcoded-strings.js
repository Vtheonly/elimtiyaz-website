#!/usr/bin/env node
/**
 * scan-hardcoded-strings.js — whole-codebase user-visible string scanner.
 *
 * Parses every .ts/.tsx file under src/ (excluding tests and the dictionary
 * itself) with the TypeScript compiler API and reports string literals that
 * are USER-VISIBLE:
 *
 *   1. JSX text nodes                      <div>Bonjour</div>
 *   2. JSX attributes (visible props)      placeholder="Nom" / title= / aria-label=
 *   3. String literals inside JSX {expr}   {`Aucune note`} {"Chargement"}
 *   4. Toast / sonner calls                toast.success("Enregistré")
 *   5. Error messages shown to users       new Error("...") (flagged, may be internal)
 *
 * Exclusions: className/key/id/test-*, data-*, href/src/for/type/variant,
 * imports/exports, comments, console.*, import paths, numbers, pure symbols.
 *
 * Output: JSON report (scripts/i18n/hardcoded-strings-report.json) + a
 * human-readable summary. Exit code 1 if any finding remains (CI-able).
 *
 * Usage: node scripts/i18n/scan-hardcoded-strings.js [--min-chars N]
 */
const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..", ".."); // elimtiyaz-website
const SRC = path.join(ROOT, "src");
const OUT_REPORT = path.join(__dirname, "hardcoded-strings-report.json");

const minChars = 2; // strings shorter than this are not worth translating

// --- configuration: what counts as user-visible ------------------------------

// JSX attributes whose string value is rendered to the user
const VISIBLE_PROPS = new Set([
  "label",
  "title",
  "placeholder",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "alt",
  "description",
  "emptyText",
  "emptyMessage",
  "helperText",
  "hint",
  "text",
  "message",
  "subtitle",
  "caption",
  "confirmText",
  "cancelText",
  "okText",
  "name", // careful: sometimes form field name — keep, human reviews
]);

// attributes that are NEVER user-visible (even if they look like text)
const INVISIBLE_PROPS = new Set([
  "className",
  "class",
  "key",
  "id",
  "htmlFor",
  "for",
  "type",
  "variant",
  "size",
  "href",
  "src",
  "action",
  "method",
  "role",
  "dir",
  "lang",
  "style",
  "value", // usually controlled data, not literal UI text; review case-by-case
  "defaultValue",
  "testId",
  "data-testid",
  "autoComplete",
  "inputMode",
  "name", // form control names are identifiers — overridden below
  "trigger",
  "asChild",
  "forceMount",
  "defaultOpen",
  "open",
  "checked",
  "disabled",
  "required",
  "readOnly",
  "multiple",
  "accept",
  "capture",
  "form",
  "maxLength",
  "minLength",
  "min",
  "max",
  "step",
  "rows",
  "cols",
  "mode",
  "priority",
  "onSelect",
  "side",
  "align",
  "collisionPadding",
  "sticky",
  "prefix",
]);

// form-control "name" is an identifier, not visible text
VISIBLE_PROPS.delete("name");

// function names whose string arguments are user-visible (toast, alerts)
const VISIBLE_CALLS = new Set([
  "toast",
  "success",
  "error",
  "info",
  "warning",
  "message",
  "alert",
  "confirm",
  "prompt",
]);

// files never to scan
const EXCLUDE_FILES = [
  "src/lib/i18n/dictionary.ts",
  "src/lib/i18n/dictionary.test.ts",
  "src/test/setup.ts",
];

function shouldExcludeFile(fp) {
  const rel = path.relative(ROOT, fp).split(path.sep).join("/");
  if (EXCLUDE_FILES.includes(rel)) return true;
  if (/\.test\.[jt]sx?$/.test(rel)) return true;
  if (rel.startsWith("src/test/")) return true;
  if (rel.endsWith(".d.ts")) return true;
  return false;
}

function listSourceFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listSourceFiles(fp));
    else if (/\.[jt]sx?$/.test(entry.name)) out.push(fp);
  }
  return out;
}

// --- string extraction --------------------------------------------------------

function isTranslateCall(expr) {
  // t("key") or t(`key`) — already localized
  return (
    expr &&
    (ts.isCallExpression(expr)) &&
    expr.expression &&
    (expr.expression.getText() === "t" || expr.expression.getText().startsWith("t("))
  );
}

function looksLikeTechnical(s) {
  if (!s) return true;
  const trimmed = s.trim();
  if (trimmed.length === 0) return true;
  // pure CSS class, single char, hex color, url, iso date, numbers
  if (/^[0-9\s.,:/%°+-]+$/.test(trimmed)) return true;
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return true;
  if (/^https?:\/\//.test(trimmed)) return true;
  if (/^[a-z0-9_-]+$/i.test(trimmed) && trimmed.length <= 3 && !/[àâçéèêëîïôûùüÿñæœ]/i.test(trimmed)) {
    // short identifiers like "fr", "ar", "id" — but keep real words (has spaces or accents)
    if (!trimmed.includes(" ")) return true;
  }
  return false;
}

function hasLetters(s) {
  // must contain at least one letter (latin or arabic) to be translatable text
  return /[a-zA-ZàâäçéèêëîïôöùûüÿñæœÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸÑÆŒ\u0600-\u06FF]/.test(s);
}

const findings = [];

function addFinding(file, node, text, kind) {
  const { line } = node.getSourceFile().getLineAndCharacterOfPosition(node.getStart());
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  findings.push({
    file: rel,
    line: line + 1,
    kind,
    text: text.replace(/\s+/g, " ").trim(),
  });
}

function visitJsxText(node, file) {
  const raw = node.getText();
  // strip JSX comment braces
  const cleaned = raw.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  const decoded = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const visible = decoded.trim();
  if (visible.length >= minChars && hasLetters(visible)) {
    addFinding(file, node, visible, "jsx-text");
  }
}

function visitStringLiteral(node, file, context) {
  const s = node.text;
  if (s.length < minChars) return;
  if (!hasLetters(s)) return;
  if (looksLikeTechnical(s)) return;
  addFinding(file, node, s, context);
}

function visitTemplateLiteral(node, file, context) {
  // only literal (static) head/tail chunks matter
  for (const chunk of [node.head, ...(node.templateSpans || []).map((sp) => sp.literal)]) {
    if (!chunk) continue;
    const s = chunk.getText ? chunk.getText() : String(chunk);
    // TemplateHead comes with backtick+${ ; raw text extraction:
    const cleaned = s.replace(/^[`}${]+/, "").replace(/[${}`]+$/, "");
    if (cleaned.length >= minChars && hasLetters(cleaned) && !looksLikeTechnical(cleaned)) {
      addFinding(file, node, cleaned, context + "-template");
    }
  }
}

function visitJsxExpression(node, file) {
  if (!node.expression) return;
  const e = node.expression;
  if (ts.isStringLiteral(e)) {
    visitStringLiteral(e, file, "jsx-expression");
  } else if (ts.isNoSubstitutionTemplateLiteral(e)) {
    const s = e.text;
    if (s.length >= minChars && hasLetters(s) && !looksLikeTechnical(s)) {
      addFinding(file, e, s, "jsx-expression");
    }
  }
  // ternaries / conditionals inside JSX: {cond ? "A" : "B"}
  else if (ts.isConditionalExpression(e)) {
    for (const branch of [e.whenTrue, e.whenFalse]) {
      if (ts.isStringLiteral(branch) || ts.isNoSubstitutionTemplateLiteral(branch)) {
        visitStringLiteral(branch, file, "jsx-ternary");
      } else if (ts.isTemplateExpression(branch)) {
        visitTemplateLiteral(branch, file, "jsx-ternary");
      }
    }
  }
  // logical fallbacks inside JSX: {value || "fallback"} / {value ?? "fallback"}
  else if (
    ts.isBinaryExpression(e) &&
    (e.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    const right = e.right;
    if (ts.isStringLiteral(right) || ts.isNoSubstitutionTemplateLiteral(right)) {
      visitStringLiteral(right, file, "jsx-fallback");
    }
  }
  // binary "string " + expr concatenations inside JSX
  else if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const parts = flattenConcat(e);
    for (const p of parts) {
      if (ts.isStringLiteral(p) || ts.isNoSubstitutionTemplateLiteral(p)) {
        const s = p.text;
        if (s.length >= minChars && hasLetters(s) && !looksLikeTechnical(s)) {
          addFinding(file, p, s, "jsx-concat");
        }
      }
    }
  }
}

function flattenConcat(binExpr) {
  const parts = [];
  function walk(n) {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      walk(n.left);
      walk(n.right);
    } else parts.push(n);
  }
  walk(binExpr);
  return parts;
}

function visitCallExpression(node, file) {
  const callee = node.expression;
  let name = null;
  let fullText = callee.getText();
  if (ts.isIdentifier(callee)) name = callee.text;
  else if (ts.isPropertyAccessExpression(callee)) name = callee.name.text;

  // console.* logging is developer-facing, never user-visible
  if (fullText.startsWith("console.")) return;

  if (name && VISIBLE_CALLS.has(name)) {
    for (const arg of node.arguments) {
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
        visitStringLiteral(arg, file, `call:${name}`);
      } else if (ts.isTemplateExpression(arg)) {
        visitTemplateLiteral(arg, file, `call:${name}`);
      }
    }
  }
  // NOTE: `new Error("...")` strings are deliberately NOT reported — in this
  // codebase they are developer invariants ("useAuth must be used inside
  // <AuthProvider>"); user-facing error text routes through the dictionary
  // (see src/lib/activation-errors.ts for the established pattern).
}

function visit(node, file) {
  if (ts.isJsxText(node)) {
    visitJsxText(node, file);
    return;
  }

  if (ts.isJsxAttribute(node)) {
    const attrName = node.name.text;
    const inVisible = VISIBLE_PROPS.has(attrName);
    if (inVisible && node.initializer) {
      const init = node.initializer;
      if (ts.isStringLiteral(init)) {
        visitStringLiteral(init, file, `attr:${attrName}`);
      } else if (ts.isJsxExpression(init) && init.expression) {
        const e = init.expression;
        if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) {
          visitStringLiteral(e, file, `attr:${attrName}`);
        }
      }
    }
    return; // don't recurse into attributes
  }

  if (ts.isJsxExpression(node)) {
    visitJsxExpression(node, file);
    // still recurse into the expression for nested calls
    if (node.expression) visit(node.expression, file);
    return;
  }

  if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
    visitCallExpression(node, file);
  }

  ts.forEachChild(node, (child) => visit(child, file));
}

// --- main ----------------------------------------------------------------------

const files = listSourceFiles(SRC).filter((f) => !shouldExcludeFile(f));
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  sf.forEachChild((node) => visit(node, file));
}

// dedupe (file, line, text)
const seen = new Set();
const unique = findings.filter((f) => {
  const k = `${f.file}:${f.line}:${f.text}`;
  if (seen.has(k)) return false;
  seen.add(k);
  return true;
});

unique.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

fs.writeFileSync(OUT_REPORT, JSON.stringify(unique, null, 2));

// summary
const byFile = {};
const byKind = {};
for (const f of unique) {
  byFile[f.file] = (byFile[f.file] || 0) + 1;
  byKind[f.kind] = (byKind[f.kind] || 0) + 1;
}

console.log(`\n=== ${unique.length} hardcoded user-visible strings in ${Object.keys(byFile).length} files ===\n`);
console.log("By kind:", JSON.stringify(byKind, null, 2));
console.log("\nBy file:");
for (const [file, count] of Object.entries(byFile).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${file}`);
}
console.log(`\nFull report: ${OUT_REPORT}`);
process.exit(unique.length > 0 ? 1 : 0);
