#!/usr/bin/env node
/**
 * Finds Supabase queries that select columns which do not exist (they fail silently
 * at runtime and return no data). Scans `.from("t").select("...")` string literals in src/.
 *
 * Usage:
 *   node scripts/check-query-columns.cjs <schema_columns.txt> [srcDir=src]
 *
 * schema_columns.txt: one "table.column" per line, e.g. from
 *   psql -Atc "select table_name||'.'||column_name from information_schema.columns where table_schema='public'"
 * Run it against a dump of PRODUCTION's schema for authoritative results.
 * Exit code 1 when any missing column is found.
 */
const fs = require("fs");
const path = require("path");
const [schemaFile, srcDir = "src"] = process.argv.slice(2);
if (!schemaFile) { console.error("usage: node scripts/check-query-columns.cjs <schema_columns.txt> [srcDir]"); process.exit(2); }

const cols = new Map();
for (const line of fs.readFileSync(schemaFile, "utf8").split(/\r?\n/)) {
  const [t, c] = line.split(".");
  if (!t || !c) continue;
  if (!cols.has(t)) cols.set(t, new Set());
  cols.get(t).add(c);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "__tests__" && e.name !== "node_modules") walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

// Split a PostgREST select string at top-level commas.
function splitTop(s) {
  const parts = []; let depth = 0, cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// Resolve an embed like "cattle!inner(...)", "cattle:cattle_id(...)", "partners(...)".
function embedTable(head) {
  let h = head.replace(/!inner|!left/g, "");
  if (h.includes(":")) { const [, target] = h.split(":"); h = target; }
  h = h.split("!")[0].trim();
  return h;
}

const problems = [];
function checkSelect(table, sel, loc) {
  if (!cols.has(table)) { problems.push([loc, table, "(table not in migrations)"]); return; }
  for (const part of splitTop(sel)) {
    if (!part || part === "*") continue;
    const m = part.match(/^([^()]+)\((.*)\)$/s);
    if (m) {
      let rel = embedTable(m[1]);
      // FK-column alias form "cattle:cattle_id(...)": target is the referenced table name guess
      if (!cols.has(rel)) {
        const alias = m[1].split(":")[0].replace(/!.*/, "").trim();
        if (cols.has(alias)) rel = alias;
      }
      if (cols.has(rel)) checkSelect(rel, m[2], loc);
      else problems.push([loc, rel, "(embedded table not in migrations)"]);
      continue;
    }
    const name = part.split("::")[0].split(":").pop().trim(); // alias:col -> col
    if (/^count$|^\w+\.\w+/.test(name)) continue;
    if (!cols.get(table).has(name)) problems.push([loc, table, name]);
  }
}

for (const file of walk(srcDir)) {
  const text = fs.readFileSync(file, "utf8");
  const re = /\.from\(\s*["'`]([a-z_0-9]+)["'`]\s*\)\s*\.select\(\s*(["'`])([^"'`]*)\2/g;
  let m;
  while ((m = re.exec(text))) {
    const line = text.slice(0, m.index).split("\n").length;
    checkSelect(m[1], m[3], `${path.relative(srcDir, file)}:${line}`);
  }
}

const byKey = new Map();
for (const [loc, t, c] of problems) {
  const k = `${t}.${c}`;
  if (!byKey.has(k)) byKey.set(k, []);
  byKey.get(k).push(loc);
}
const rows = [...byKey.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [k, locs] of rows) console.log(String(locs.length).padStart(3), k.padEnd(48), locs.slice(0, 3).join("  "));
console.log(`\n${problems.length} missing-column references across ${new Set(problems.map((p) => p[0])).size} query sites`);
process.exitCode = problems.length ? 1 : 0;
