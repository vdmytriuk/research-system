#!/usr/bin/env node
// Fetches a page itself — not a model-written summary — and prints its plain text.
// Usage: node scripts/fetch.mjs <url> [--find "<quote>"] [--save <slug>] [--by scout|user] [--max <chars>]
//   --find   checks that the quote occurs in the page (case, whitespace and punctuation ignored)
//   --save   writes a copy to raw/<yyyy-mm-dd>-<slug>.md once (never overwrites; adds -2, -3 …)
// Exit: 0 ok · 2 HTTP error (blocked, 404 …) · 3 network error · 4 PDF without pdftotext · 5 quote not found.
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { ROOT, normaliseUrl } from "./_lib.mjs";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "„", copy: "©", deg: "°", euro: "€", times: "×", plus: "+", minus: "−", middot: "·", bull: "•", shy: "", reg: "®", trade: "™" };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html) {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6]|section|article|header|footer|blockquote|table|ul|ol)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/t[dh]>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(text)
    .split("\n").map(l => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l, i, a) => l || (a[i - 1] ?? "") !== "")
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export const titleOf = html => decodeEntities((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").replace(/\s+/g, " ").trim());

// Letters and digits only, lower-case: the comparison the critic's quote check allows.
export const normaliseForMatch = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
export const findQuote = (text, quote) => normaliseForMatch(quote).length > 0 && normaliseForMatch(text).includes(normaliseForMatch(quote));

function charsetOf(contentType, bytes) {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1];
  if (fromHeader) return fromHeader;
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, 4096));
  return /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8";
}

function decode(bytes, charset) {
  try { return new TextDecoder(charset).decode(bytes); } catch { return new TextDecoder("utf-8").decode(bytes); }
}

function pdfToText(bytes) {
  const dir = mkdtempSync(join(tmpdir(), "fetch-pdf-"));
  const file = join(dir, "doc.pdf");
  writeFileSync(file, bytes);
  const r = spawnSync("pdftotext", [file, "-"], { encoding: "utf8" });
  rmSync(dir, { recursive: true, force: true });
  if (r.error) return null;
  return r.stdout;
}

function saveRaw(slug, by, url, title, text, today) {
  const base = join(ROOT, "raw", `${today}-${slug}`);
  let path = `${base}.md`;
  for (let n = 2; existsSync(path); n++) path = `${base}-${n}.md`;
  const source = "S-" + createHash("sha1").update(normaliseUrl(url)).digest("hex").slice(0, 8);
  writeFileSync(path, `---\nurl: ${url}\ntitle: ${JSON.stringify(title)}\nfetched: ${today}\nadded_by: ${by}\nsource: ${source}\n---\n\n${text}\n`);
  return path;
}

async function main(argv) {
  const url = argv.find(a => !a.startsWith("--") && !argv[argv.indexOf(a) - 1]?.startsWith("--"));
  const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
  if (!url) { console.error('usage: node scripts/fetch.mjs <url> [--find "<quote>"] [--save <slug>] [--by scout|user] [--max <chars>]'); return 1; }
  const max = Number(opt("--max") ?? 100000);
  const today = new Date().toLocaleDateString("sv-SE");

  let res;
  try {
    res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8" }, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    console.error(`fetch: network error for ${url}: ${e.cause?.code ?? e.message}`);
    return 3;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const type = res.headers.get("content-type") ?? "";
  const isPdf = /pdf/i.test(type) || (/\.pdf($|\?)/i.test(url) && !/html/i.test(type));
  let text, title = "";
  if (isPdf) {
    text = pdfToText(bytes);
    if (text === null) { console.error("fetch: PDF needs `pdftotext` (poppler), which is not installed; read it another way and treat a quote as «дослівна цитата недоступна»."); return 4; }
  } else {
    const raw = decode(bytes, charsetOf(type, bytes));
    const html = /html|xml/i.test(type) || /^\s*</.test(raw);
    title = html ? titleOf(raw) : "";
    text = html ? htmlToText(raw) : raw.trim();
  }

  console.log(`url: ${url}\nfinal_url: ${res.url}\nstatus: ${res.status}\ncontent_type: ${type}\nfetched: ${today}\ntitle: ${title}`);
  if (!res.ok) {
    console.log(`---\n${text.slice(0, 300)}`);
    console.error(`fetch: HTTP ${res.status} — blocked or missing; try web.archive.org once, then list the URL as a gap.`);
    return 2;
  }
  const quote = opt("--find");
  if (quote !== undefined) console.log(`quote: ${findQuote(text, quote) ? "found" : "NOT found"}`);
  const slug = opt("--save");
  if (slug) console.log(`saved: ${saveRaw(slug, opt("--by") ?? "scout", url, title, text, today)}`);
  console.log(`---\n${text.length > max ? `${text.slice(0, max)}\n[обрізано: ${text.length} символів; --max змінює межу]` : text}`);
  return quote !== undefined && !findQuote(text, quote) ? 5 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await main(process.argv.slice(2));
