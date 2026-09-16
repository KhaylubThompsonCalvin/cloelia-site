#!/usr/bin/env node
// Validation beyond the schemas: relationships between collections, the standard's cross-entity rules,
// banned characters and machine paths in source and content, and (when dist/ exists) the built output.
// Exit 0 on PASS, 1 with named failures. Run before and after `astro build`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { load as yamlLoad } from 'js-yaml';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const EM_DASH = String.fromCharCode(0x2014);
// Built from fragments so this file does not itself contain the banned strings.
const banned = ['C:\\\\Users', '/Users/[A-Za-z]', ['One', 'Drive'].join(''), ['Desktop', '\\\\Projects'].join(''), ['Knowledge', ' Base'].join('')];
const PATH_PATTERNS = banned.map((b) => new RegExp(b, 'i'));
const failures = [];
const fail = (where, reason) => failures.push(`[${where}] ${reason}`);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '.astro') walk(p, out); }
    else out.push(p);
  }
  return out;
}
const rel = (p) => p.slice(root.length + 1).replace(/\\/g, '/');
const TEXT_EXT = new Set(['.astro', '.ts', '.mjs', '.js', '.css', '.yaml', '.yml', '.json', '.md', '.html', '.xml', '.svg']);

function loadDir(name) {
  const dir = join(root, 'src', 'content', name);
  const out = new Map();
  for (const f of walk(dir).filter((p) => p.endsWith('.yaml'))) out.set(rel(f).split('/').pop().replace(/\.yaml$/, ''), yamlLoad(readFileSync(f, 'utf8')));
  return out;
}
function loadBridge(name) {
  const dir = join(root, 'src', 'content', 'bridge', name);
  const out = new Map();
  for (const f of walk(dir).filter((p) => p.endsWith('.json'))) out.set(rel(f).split('/').pop().replace(/\.json$/, ''), JSON.parse(readFileSync(f, 'utf8')));
  return out;
}

// 1. banned characters and machine paths in src/, scripts/, tests/, and the config files
for (const f of [...walk(join(root, 'src')), ...walk(join(root, 'scripts')), ...walk(join(root, 'tests')), join(root, 'astro.config.mjs'), join(root, 'render.yaml'), join(root, 'README.md'), join(root, 'CLAUDE.md')]) {
  if (!existsSync(f) || !TEXT_EXT.has(extname(f))) continue;
  const text = readFileSync(f, 'utf8');
  if (text.includes(EM_DASH)) fail(rel(f), 'em dash');
  for (const re of PATH_PATTERNS) if (re.test(text)) fail(rel(f), `machine path matches ${re}`);
}

// 2. relationships and the standard's cross-entity rules
const dimensions = loadDir('dimensions'), places = loadDir('places'), populations = loadDir('populations'), sources = loadDir('sources');
const developments = loadDir('developments'), questions = loadDir('questions'), corrections = loadDir('corrections'), records = loadDir('records');
const investigations = loadBridge('investigations'), measures = loadBridge('measures'), findings = loadBridge('findings'), charts = loadBridge('charts'), datasets = loadBridge('datasets');

for (const [id, r] of records) {
  const w = `records/${id}.yaml`;
  if (!dimensions.has(r.dimension)) fail(w, `dimension ${r.dimension} does not exist`);
  if (!places.has(r.place)) fail(w, `place ${r.place} does not exist`);
  for (const m of r.measures || []) {
    if (!measures.has(m)) fail(w, `measure ${m} is not bridged`);
    else if (!(measures.get(m).geographies || []).includes(r.place)) fail(w, `measure ${m} carries no series for ${r.place}`);
  }
  const [inv, fid] = String(r.headline_finding).split(':');
  const set = findings.get(inv);
  if (!set) fail(w, `headline_finding refers to investigation ${inv}, which is not bridged`);
  else {
    const item = set.items.find((i) => i.id === fid);
    if (!item) fail(w, `headline_finding ${fid} is not in ${inv}`);
    else if (item.grade !== 'measured') fail(w, `the headline finding must be graded measured (the scan layer states the major measured change); ${fid} is ${item.grade}`);
  }
  const devs = [...developments.values()].filter((d) => d.record.dimension === r.dimension && d.record.place === r.place);
  if (devs.length === 0 && r.status === 'published') fail(w, 'a published Record needs at least one development');
}
for (const [id, d] of developments) {
  const w = `developments/${id}.yaml`;
  for (const p of d.applies_to || []) if (!populations.has(p)) fail(w, `population ${p} does not exist`);
  for (const s of d.sources || []) if (!sources.has(s)) fail(w, `source ${s} does not exist`);
  if (!dimensions.has(d.record.dimension) || !places.has(d.record.place)) fail(w, 'record reference does not resolve');
  const hasRecord = [...records.values()].some((r) => r.dimension === d.record.dimension && r.place === d.record.place);
  if (!hasRecord) fail(w, `no Record exists for ${d.record.dimension}/${d.record.place}`);
}
for (const [id, q] of questions) {
  const w = `questions/${id}.yaml`;
  if (!dimensions.has(q.record.dimension) || !places.has(q.record.place)) fail(w, 'record reference does not resolve');
  if (q.investigation && !investigations.has(q.investigation)) fail(w, `investigation ${q.investigation} is not bridged`);
  if (q.status === 'in-investigation' && !q.investigation) fail(w, 'a question in investigation must name it');
}
for (const [id, m] of measures) {
  const w = `bridge/measures/${id}.json`;
  if (!datasets.has(m.dataset)) fail(w, `dataset ${m.dataset} is not bridged`);
  if (!investigations.has(m.investigation)) fail(w, `investigation ${m.investigation} is not bridged`);
  for (const g of m.geographies || []) if (!places.has(g)) fail(w, `geography ${g} has no place entry (add src/content/places/${g}.yaml)`);
}
for (const [id, c] of charts) {
  const w = `bridge/charts/${id}.json`;
  for (const m of c.measures || []) if (!measures.has(m)) fail(w, `measure ${m} is not bridged`);
  const file = join(root, 'public', c.public_path.replace(/^\//, ''));
  if (!existsSync(file)) fail(w, `chart file ${c.public_path} missing from public/`);
  if (!c.description || c.description.length < 20) fail(w, 'alt text (description) must say what the chart shows');
}
for (const [id, set] of findings) {
  const w = `bridge/findings/${id}.json`;
  for (const f of set.items) {
    if (f.grade === 'measured' && !measures.has(f.support?.measure)) fail(w, `${f.id}: measured finding cites an unbridged measure`);
  }
}
for (const [id, inv] of investigations) {
  const w = `bridge/investigations/${id}.json`;
  if (!dimensions.has(inv.record.dimension) || !places.has(inv.record.place)) fail(w, 'record reference does not resolve');
}
for (const [id, c] of corrections) {
  if (!String(c.target).startsWith('/')) fail(`corrections/${id}.yaml`, 'target must be a site path');
}
const lock = join(root, 'bridge.lock.json');
if (!existsSync(lock)) fail('bridge.lock.json', 'missing: run npm run bridge');

// 3. the built output, when present
const dist = join(root, 'dist');
if (existsSync(dist)) {
  for (const f of walk(dist).filter((p) => p.endsWith('.html'))) {
    const html = readFileSync(f, 'utf8');
    if (html.includes(EM_DASH)) fail(rel(f), 'em dash in built HTML');
    for (const re of PATH_PATTERNS) if (re.test(html)) fail(rel(f), `machine path in built HTML: ${re}`);
    if (/<img(?![^>]*\balt=)[^>]*>/i.test(html)) fail(rel(f), 'an <img> without alt');
    if (/<script(?![^>]*\bsrc=)[^>]*>[^<]/i.test(html)) fail(rel(f), 'inline script (the CSP forbids it)');
    if (/\sstyle="/i.test(html)) fail(rel(f), 'inline style attribute (the CSP forbids it)');
  }
  const record = walk(join(dist, 'records')).filter((p) => p.endsWith('index.html'));
  for (const f of record) {
    const html = readFileSync(f, 'utf8');
    const order = ['id="changed"', 'id="happened"', 'id="followed"', 'id="concluded"', 'id="unknown"', 'id="verify"'];
    let last = -1;
    for (const marker of order) { const i = html.indexOf(marker); if (i < 0) fail(rel(f), `section ${marker} missing`); else if (i < last) fail(rel(f), `section ${marker} out of order`); else last = i; }
    if (!html.includes('data-test="scan"')) fail(rel(f), 'scan block missing');
  }
}

if (failures.length) { for (const f of failures) console.error(`FAIL  ${f}`); console.error(`validate FAILED (${failures.length})`); process.exit(1); }
console.log(`validate PASS (${dimensions.size} dimensions, ${places.size} places, ${records.size} records, ${developments.size} developments, ${sources.size} sources, ${questions.size} questions, ${investigations.size} investigations, ${measures.size} measures, ${charts.size} charts, ${datasets.size} datasets${existsSync(dist) ? '; built output checked' : ''})`);
