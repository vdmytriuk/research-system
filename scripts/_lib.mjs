// Shared helpers: walk wiki, parse a small YAML subset from frontmatter.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

// RESEARCH_ROOT points the scripts at another repository root (used by scripts/tests).
export const ROOT = process.env.RESEARCH_ROOT ?? new URL("..", import.meta.url).pathname.replace(/\/$/, "");
export const WIKI = join(ROOT, "wiki");

export function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

// Parses: scalars, quoted strings, [a, b] lists, and one-level nested maps (indented).
export function parseFrontmatter(text) {
  if (!text.startsWith("---")) return { fm: null, body: text };
  const end = text.indexOf("\n---", 3);
  if (end === -1) return { fm: null, body: text };
  const block = text.slice(3, end).split("\n");
  const fm = {};
  let currentMap = null;
  for (let raw of block) {
    const line = raw.replace(/\s+#.*$/, ""); // strip trailing comments
    if (!line.trim()) continue;
    const nested = /^\s+(\w[\w-]*):\s*(.*)$/.exec(line);
    if (nested && currentMap) { currentMap[nested[1]] = scalar(nested[2]); continue; }
    const m = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, key, val] = m;
    if (val === "") { fm[key] = {}; currentMap = fm[key]; continue; }
    currentMap = null;
    fm[key] = scalar(val);
  }
  return { fm, body: text.slice(end + 4) };
}

function scalar(v) {
  v = v.trim();
  if (v === "null" || v === "~") return null;
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(",").map(s => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  if (/^\{.*\}$/.test(v)) { // flow map {a: 1, b: 2}
    const o = {};
    for (const part of v.slice(1, -1).split(",")) { const [k, ...r] = part.split(":"); if (k?.trim()) o[k.trim()] = scalar(r.join(":")); }
    return o;
  }
  if (/^["'].*["']$/.test(v)) return v.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

export function loadWiki() {
  return walk(WIKI).map(path => {
    const text = readFileSync(path, "utf8");
    const { fm, body } = parseFrontmatter(text);
    return { path, rel: relative(ROOT, path), fm, body, text };
  });
}

export function normaliseUrl(u) {
  try {
    const url = new URL(u);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    const drop = [...url.searchParams.keys()].filter(k => /^(utm_|fbclid|gclid|ref$|source$)/i.test(k));
    drop.forEach(k => url.searchParams.delete(k));
    let s = url.toString().replace(/\/$/, "");
    return s.replace(/^https?:\/\//, "");
  } catch { return u.trim().toLowerCase(); }
}

// Pages of one wiki folder that have frontmatter, e.g. under(pages, "domains").
export const under = (pages, dir) => pages.filter(p => p.rel.startsWith(`wiki/${dir}/`) && p.fm);

// Text of a `## <title>` section of a page body, up to the next `## ` heading ("" if absent).
export function section(body, title) {
  const lines = body.split("\n");
  const start = lines.findIndex(l => l.trim() === `## ${title}`);
  if (start < 0) return "";
  const out = [];
  for (const l of lines.slice(start + 1)) { if (/^## /.test(l)) break; out.push(l); }
  return out.join("\n").trim();
}

// A screening brief has a decision once «Рішення відбору» holds more than its template placeholder.
export const screenDecided = p => {
  const s = section(p.body ?? "", "Рішення відбору");
  return s !== "" && !/^_\(/.test(s);
};

// The critic's proposed wording on an inexact or failed page («Коректне формулювання: «…»»).
export const correctionOf = body => /Коректне формулювання:\s*(«[^\n]*»|—)/.exec(section(body, "Верифікація"))?.[1] ?? null;
