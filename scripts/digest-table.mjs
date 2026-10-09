#!/usr/bin/env node
// The evidence of one brief as tables, for writing the digest without opening every page.
// Usage: node scripts/digest-table.mjs <B-ID> [--sources]
//   per sub-question: ID · type · grade · confidence · verification · claim;
//   tallies, pages whose critic correction still waits (research step 7), numeric claims
//   without a verdict, contradictions; --sources adds sub-question → source → evidence.
import { loadWiki, under, correctionOf } from "./_lib.mjs";

const id = process.argv[2];
const withSources = process.argv.includes("--sources");
if (!id || !/^B-\d{3}$/.test(id)) { console.error("usage: node scripts/digest-table.mjs <B-ID> [--sources]"); process.exit(1); }

const pages = loadWiki();
const brief = under(pages, "briefs").find(b => b.fm.id === id);
if (!brief) { console.error(`unknown brief ${id}`); process.exit(1); }
const prefix = "E-" + id.replace("-", "") + "-";
const evidence = under(pages, "evidence").filter(e => String(e.fm.id).startsWith(prefix))
  .sort((a, b) => String(a.fm.id).localeCompare(String(b.fm.id), undefined, { numeric: true }));
const sources = new Map(under(pages, "sources").map(s => [s.fm.id, s]));
const titles = new Map([...brief.body.matchAll(/^### (\d+)\. (.*)$/gm)].map(m => [m[1], m[2].trim()]));
const sqOf = e => String(e.fm.id).slice(prefix.length).split("-")[0];
const cell = v => String(v ?? "—").replace(/\|/g, "/").replace(/\n/g, " ");
const count = (list, f) => { const o = {}; for (const e of list) { const k = f(e) ?? "—"; o[k] = (o[k] ?? 0) + 1; } return o; };
const fmt = o => Object.entries(o).sort().map(([k, v]) => `${k} ${v}`).join(" · ") || "—";
const needsVerdict = e => e.fm.type !== "absence" && /\d/.test(String(e.fm.claim));
const pending = e => ["inexact", "failed"].includes(e.fm.verification) && !e.fm.corrected;

const out = [`# ${id} — ${brief.fm.question ?? ""}`, ""];
const real = evidence.filter(e => e.fm.type !== "absence");
out.push(`evidence ${evidence.length} · ${fmt(count(evidence, e => e.fm.verification ?? "unverified"))} · absence ${evidence.length - real.length}`);
out.push(`grade (без absence): ${fmt(count(real, e => e.fm.source_grade))} · confidence: ${fmt(count(evidence, e => e.fm.confidence))}`);

const bySq = new Map();
for (const e of evidence) { const sq = sqOf(e); if (!bySq.has(sq)) bySq.set(sq, []); bySq.get(sq).push(e); }
for (const sq of [...new Set([...titles.keys(), ...bySq.keys()])].sort((a, b) => a - b)) {
  out.push("", `## ${sq}. ${titles.get(sq) ?? "(підпитання не знайдено в brief)"}`);
  const list = bySq.get(sq) ?? [];
  if (!list.length) { out.push("_(доказів немає)_"); continue; }
  out.push("| ID | тип | grade | conf | verif | claim |", "|---|---|---|---|---|---|");
  for (const e of list) out.push(`| ${e.fm.id} | ${cell(e.fm.type)} | ${cell(e.fm.source_grade)} | ${cell(e.fm.confidence)} | ${cell(e.fm.verification)}${e.fm.corrected ? " ✎" : ""} | ${cell(e.fm.claim)} |`);
}

const waiting = evidence.filter(pending);
out.push("", "## Виправлення критика чекають (research, крок 7)");
out.push(...(waiting.length ? waiting.map(e => `- ${e.fm.id} (${e.fm.verification}): ${correctionOf(e.body) ?? "формулювання критика не знайдено — див. «Верифікація»"}`) : ["- немає"]));

const unverified = evidence.filter(e => needsVerdict(e) && e.fm.verification == null);
out.push("", "## Числа без вердикту");
out.push(...(unverified.length ? unverified.map(e => `- ${e.fm.id}: ${cell(e.fm.claim)}`) : ["- немає"]));

const pairs = new Set();
for (const e of evidence) for (const c of e.fm.contradicts ?? []) pairs.add([e.fm.id, c].sort().join(" vs "));
out.push("", "## Протиріччя");
out.push(...(pairs.size ? [...pairs].map(p => `- ${p}`) : ["- немає"]));

if (withSources) {
  out.push("", "## Джерела");
  for (const [sq, list] of [...bySq].sort((a, b) => a[0] - b[0])) {
    out.push(`### ${sq}`);
    const bySource = new Map();
    for (const e of list) { const s = e.fm.source ?? "absence"; if (!bySource.has(s)) bySource.set(s, []); bySource.get(s).push(e.fm.id); }
    for (const [s, ids] of bySource) {
      const sp = sources.get(s);
      out.push(`- ${s}${sp ? ` (${sp.fm.grade}, ${cell(sp.fm.publisher)}) — ${cell(sp.fm.title)}` : ""}: ${ids.join(", ")}`);
    }
  }
}
console.log(out.join("\n"));
