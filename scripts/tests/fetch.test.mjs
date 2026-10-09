// Run: node scripts/tests/fetch.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { htmlToText, findQuote, titleOf } from "../fetch.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "fetch.mjs");
const PAGE = `<html><head><title>Звіт &amp; дані</title><style>.x{}</style></head><body>
<script>var hidden = "do not show";</script><h1>Ринок</h1><p>Ціна&nbsp;РДН у 2025 році — 5 292 грн/МВт·год.</p>
<ul><li>перший</li><li>другий</li></ul></body></html>`;
// "Привіт" in windows-1251.
const CP1251 = Buffer.from([0xcf, 0xf0, 0xe8, 0xe2, 0xb3, 0xf2]);

let server, base;
before(async () => {
  server = createServer((req, res) => {
    if (req.url === "/page") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(PAGE); }
    else if (req.url === "/cp1251") { res.writeHead(200, { "content-type": "text/html; charset=windows-1251" }); res.end(Buffer.concat([Buffer.from("<p>"), CP1251, Buffer.from("</p>")])); }
    else { res.writeHead(403, { "content-type": "text/html" }); res.end("<p>Access denied</p>"); }
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

// spawn, not spawnSync: the server lives in this process and must keep answering.
function cli(args, root) {
  return new Promise(resolve => {
    const p = spawn(process.execPath, [SCRIPT, ...args], { env: { ...process.env, RESEARCH_ROOT: root } });
    let out = "";
    p.stdout.on("data", d => (out += d));
    p.stderr.on("data", d => (out += d));
    p.on("close", code => resolve({ code, out }));
  });
}
const tmpRoot = () => { const r = mkdtempSync(join(tmpdir(), "fetch-root-")); mkdirSync(join(r, "raw")); return r; };

test("htmlToText drops scripts and styles, keeps blocks, decodes entities", () => {
  const text = htmlToText(PAGE);
  assert.doesNotMatch(text, /hidden|\.x\{\}/);
  assert.match(text, /Ринок\nЦіна РДН у 2025 році — 5 292 грн\/МВт·год\./);
  assert.match(text, /- перший\n- другий/);
  assert.equal(titleOf(PAGE), "Звіт & дані");
});

test("findQuote ignores case, whitespace, punctuation and quote styles", () => {
  const text = "Постачальник мусить мати «динамічну» ціну,\nприв'язану до РДН.";
  assert.ok(findQuote(text, 'постачальник мусить мати "динамічну" ціну, прив’язану до РДН'));
  assert.ok(!findQuote(text, "постачальник може мати динамічну ціну"));
  assert.ok(!findQuote(text, "  … "));
});

test("prints the page text and reports a found quote", async () => {
  const { code, out } = await cli([`${base}/page`, "--find", "Ціна РДН у 2025 році"], tmpRoot());
  assert.equal(code, 0, out);
  assert.match(out, /^status: 200$/m);
  assert.match(out, /^quote: found$/m);
  assert.match(out, /5 292 грн/);
});

test("exits 5 when the quote is not on the page", async () => {
  const { code, out } = await cli([`${base}/page`, "--find", "ціна впала вдвічі"], tmpRoot());
  assert.equal(code, 5, out);
  assert.match(out, /^quote: NOT found$/m);
});

test("exits 2 on a blocked page and says so", async () => {
  const { code, out } = await cli([`${base}/blocked`], tmpRoot());
  assert.equal(code, 2, out);
  assert.match(out, /HTTP 403/);
});

test("decodes a windows-1251 page", async () => {
  const { out } = await cli([`${base}/cp1251`], tmpRoot());
  assert.match(out, /Привіт/);
});

test("--save writes raw/ once and never overwrites", async () => {
  const root = tmpRoot();
  await cli([`${base}/page`, "--save", "market-report"], root);
  await cli([`${base}/page`, "--save", "market-report"], root);
  const files = readdirSync(join(root, "raw")).sort();
  assert.equal(files.length, 2);
  assert.match(files[0], /^\d{4}-\d{2}-\d{2}-market-report-2\.md$|^\d{4}-\d{2}-\d{2}-market-report\.md$/);
  const first = readFileSync(join(root, "raw", files.find(f => !f.includes("-2."))), "utf8");
  assert.match(first, /^---\nurl: http:\/\/127\.0\.0\.1:\d+\/page\ntitle: "Звіт & дані"\nfetched: \d{4}-\d{2}-\d{2}\nadded_by: scout\nsource: S-[0-9a-f]{8}\n---\n/);
});
