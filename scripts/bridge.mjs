#!/usr/bin/env node
// The one-way bridge from the lab (cloelia-investigations) to this site.
//
//   node scripts/bridge.mjs                 bridge every verified/published investigation from the lab
//   node scripts/bridge.mjs --fixture       bridge the lab's valid test fixture (Phase 4: fixture content only)
//   LAB_DIR=<path> node scripts/bridge.mjs  the lab lives elsewhere than ../cloelia-investigations
//
// It reads each investigation's publish/ folder (artifact contract v1), re-checks the fields the
// standard requires (mirroring the lab's check_publish.py), converts measure CSVs to typed rows, copies
// chart files into public/charts/<investigation>/, and writes JSON into src/content/bridge/. It records
// the lab commit it consumed in bridge.lock.json. The output is committed: the site builds without the
// lab present, and every published number traces to a lab commit, a notebook cell, and a raw hash.
// The bridge never writes to the lab.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const labDir = resolve(process.env.LAB_DIR || join(root, '..', 'cloelia-investigations'));
const fixtureMode = process.argv.includes('--fixture');
const GRADES = new Set(['measured', 'documented', 'inferred', 'contested', 'insufficient']);
const CSV_COLUMNS = ['year', 'geography', 'population', 'value', 'unit', 'definition_version'];
const EM_DASH = String.fromCharCode(0x2014);
const failures = [];
const fail = (where, reason) => failures.push(`[${where}] ${reason}`);

function readJson(path, where) {
  if (!existsSync(path)) { fail(where, 'missing'); return null; }
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch (e) { fail(where, `invalid JSON: ${e.message}`); return null; }
}
const nonempty = (v) => typeof v === 'string' && v.trim() !== '';
const noEmDash = (obj, where, path = '') => {
  if (typeof obj === 'string') { if (obj.includes(EM_DASH)) fail(where, `em dash in ${path || 'text'}`); }
  else if (Array.isArray(obj)) obj.forEach((v, i) => noEmDash(v, where, `${path}[${i}]`));
  else if (obj && typeof obj === 'object') for (const [k, v] of Object.entries(obj)) noEmDash(v, where, path ? `${path}.${k}` : k);
};

function parseCsv(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0);
  const header = lines[0].split(',');
  return { header, rows: lines.slice(1).map((l) => l.split(',')) };
}

function bridgeOne(invDir, labCommit, today) {
  const id = basename(invDir);
  const pub = join(invDir, 'publish');
  const w = (f) => `${id}/publish/${f}`;
  const inv = readJson(join(pub, 'investigation.json'), w('investigation.json'));
  if (!inv) return null;
  noEmDash(inv, w('investigation.json'));
  if (inv.contract_version !== '1.0.0') fail(w('investigation.json'), 'contract_version must be 1.0.0');
  if (inv.id !== id) fail(w('investigation.json'), `id ${inv.id} does not match the folder ${id}`);
  if (!['verified', 'published'].includes(inv.status)) { return { skipped: `status ${inv.status}` }; }
  const v = inv.verification || {};
  if (!(v.run_all_sequential === true && v.zero_errors === true && v.raw_hashes_match === true)) fail(w('investigation.json'), 'verification flags must all be true');
  for (const k of ['question', 'hypothesis', 'assistance']) if (!nonempty(inv[k])) fail(w('investigation.json'), `${k} is required`);
  if (!(inv.record && nonempty(inv.record.dimension) && nonempty(inv.record.place))) fail(w('investigation.json'), 'record.dimension and record.place are required');

  const sources = readJson(join(pub, 'sources.json'), w('sources.json')) || { datasets: [], sources: [] };
  noEmDash(sources, w('sources.json'));
  const datasetIds = new Set();
  for (const [i, d] of (sources.datasets || []).entries()) {
    for (const k of ['dataset_id', 'publisher', 'name', 'url', 'retrieved', 'geography', 'format', 'sha256', 'license']) if (!nonempty(d[k])) fail(w('sources.json'), `datasets[${i}].${k} is required`);
    if (typeof d.sha256 === 'string' && !/^[0-9a-f]{64}$/.test(d.sha256)) fail(w('sources.json'), `datasets[${i}].sha256 must be 64 hex characters`);
    datasetIds.add(d.dataset_id);
  }

  const measures = [];
  const mdir = join(pub, 'measures');
  if (!existsSync(mdir)) fail(w('measures/'), 'folder missing');
  else for (const f of readdirSync(mdir).filter((n) => n.endsWith('.csv'))) {
    const slug = f.replace(/\.csv$/, '');
    const meta = readJson(join(mdir, `${slug}.json`), w(`measures/${slug}.json`));
    const { header, rows } = parseCsv(readFileSync(join(mdir, f), 'utf8'));
    if (header.join(',') !== CSV_COLUMNS.join(',')) { fail(w(`measures/${f}`), `columns must be ${CSV_COLUMNS.join(',')}`); continue; }
    const typed = [];
    const seen = new Set();
    const gaps = new Set();
    for (const [n, r] of rows.entries()) {
      if (r.length !== CSV_COLUMNS.length) { fail(w(`measures/${f}`), `row ${n + 2}: expected ${CSV_COLUMNS.length} columns`); continue; }
      const [year, geography, population, value, unit, definition_version] = r;
      const y = Number.parseInt(year, 10);
      if (!Number.isInteger(y)) { fail(w(`measures/${f}`), `row ${n + 2}: year ${year} is not an integer`); continue; }
      const key = `${y}|${geography}|${population}`;
      if (seen.has(key)) fail(w(`measures/${f}`), `row ${n + 2}: duplicate (year, geography, population)`);
      seen.add(key);
      let val = null;
      if (value.trim() === '') gaps.add(y);
      else { val = Number(value); if (!Number.isFinite(val)) fail(w(`measures/${f}`), `row ${n + 2}: value ${value} is not numeric (no estimates, no notes)`); }
      typed.push({ year: y, geography, population, value: val, unit, definition_version });
    }
    if (!meta) continue;
    noEmDash(meta, w(`measures/${slug}.json`));
    for (const k of ['name', 'definition', 'unit', 'population', 'dataset']) if (!nonempty(meta[k])) fail(w(`measures/${slug}.json`), `${k} is required`);
    if (!datasetIds.has(meta.dataset)) fail(w(`measures/${slug}.json`), `dataset ${meta.dataset} is not in sources.json`);
    if (!Number.isInteger(meta.cell)) fail(w(`measures/${slug}.json`), 'cell must be an integer');
    const declared = new Set(meta.gaps || []);
    if ([...declared].sort().join() !== [...gaps].sort().join()) fail(w(`measures/${slug}.json`), `gaps ${[...declared]} must equal the empty values in the CSV ${[...gaps]}`);
    measures.push({ ...meta, investigation: id, rows: typed });
  }
  const measureSlugs = new Set(measures.map((m) => m.slug));

  const findings = readJson(join(pub, 'findings.json'), w('findings.json'));
  if (findings) {
    noEmDash(findings, w('findings.json'));
    if (!Array.isArray(findings) || findings.length === 0) fail(w('findings.json'), 'must be a non-empty array');
    else for (const f of findings) {
      if (!GRADES.has(f.grade)) { fail(w('findings.json'), `${f.id}: grade is required`); continue; }
      if (!nonempty(f.text) || !nonempty(f.limitations)) fail(w('findings.json'), `${f.id}: text and limitations are required`);
      const s = f.support || {};
      if (f.grade === 'measured' && !(measureSlugs.has(s.measure) && Number.isInteger(s.cell))) fail(w('findings.json'), `${f.id}: a measured finding needs a published measure and a cell`);
      if (f.grade === 'documented' && !(Array.isArray(s.sources) && s.sources.length)) fail(w('findings.json'), `${f.id}: a documented finding needs sources`);
      if (f.grade === 'inferred' && !(Array.isArray(s.rests_on) && s.rests_on.length && nonempty(s.reasoning))) fail(w('findings.json'), `${f.id}: an inferred finding needs rests_on and reasoning`);
      if (f.grade === 'contested' && !(Array.isArray(s.positions) && s.positions.length >= 2)) fail(w('findings.json'), `${f.id}: a contested finding needs two positions`);
      if (f.grade === 'insufficient' && !(nonempty(s.looked_for) && nonempty(s.where) && nonempty(s.would_answer))) fail(w('findings.json'), `${f.id}: an insufficient-evidence finding needs looked_for, where, would_answer`);
    }
  }

  const charts = [];
  const cdir = join(pub, 'charts');
  if (existsSync(cdir)) for (const f of readdirSync(cdir).filter((n) => n.endsWith('.json'))) {
    const meta = readJson(join(cdir, f), w(`charts/${f}`));
    if (!meta) continue;
    noEmDash(meta, w(`charts/${f}`));
    for (const k of ['slug', 'file', 'title', 'description', 'caption']) if (!nonempty(meta[k])) fail(w(`charts/${f}`), `${k} is required`);
    if (!existsSync(join(cdir, meta.file || ''))) fail(w(`charts/${f}`), `file ${meta.file} does not exist`);
    if (meta.has_chronicle_marks === true && !String(meta.caption).includes('not cause')) fail(w(`charts/${f}`), 'a chart with chronicle marks needs the co-occurrence caption');
    charts.push({ ...meta, investigation: id, public_path: `/charts/${id}/${meta.file}` });
  }
  return { inv: { ...inv, lab_commit: labCommit, bridged_on: today }, sources, measures, findings: findings || [], charts, cdir };
}

function main() {
  if (!existsSync(labDir)) { console.error(`lab not found at ${labDir} (set LAB_DIR)`); process.exit(1); }
  let labCommit = 'unknown';
  try { labCommit = execSync('git rev-parse HEAD', { cwd: labDir, encoding: 'utf8' }).trim(); } catch { fail('lab', 'could not read the lab commit'); }
  const today = new Date().toISOString().slice(0, 10);
  const invDirs = fixtureMode
    ? [join(labDir, 'tests', 'fixtures', 'publish-valid', '000-fixture')]
    : readdirSync(join(labDir, 'investigations')).map((n) => join(labDir, 'investigations', n)).filter((p) => existsSync(join(p, 'publish', 'investigation.json')));
  const out = join(root, 'src', 'content', 'bridge');
  for (const sub of ['investigations', 'measures', 'findings', 'charts', 'datasets']) { rmSync(join(out, sub), { recursive: true, force: true }); mkdirSync(join(out, sub), { recursive: true }); }
  rmSync(join(root, 'public', 'charts'), { recursive: true, force: true });
  const bridged = [];
  for (const dir of invDirs) {
    const r = bridgeOne(dir, labCommit, today);
    if (!r || r.skipped) { if (r?.skipped) console.log(`skip ${basename(dir)}: ${r.skipped}`); continue; }
    if (failures.length) continue;
    const id = r.inv.id;
    writeFileSync(join(out, 'investigations', `${id}.json`), JSON.stringify(r.inv, null, 2) + '\n');
    for (const m of r.measures) writeFileSync(join(out, 'measures', `${m.slug}.json`), JSON.stringify(m, null, 2) + '\n');
    writeFileSync(join(out, 'findings', `${id}.json`), JSON.stringify({ investigation: id, items: r.findings }, null, 2) + '\n');
    for (const d of r.sources.datasets || []) writeFileSync(join(out, 'datasets', `${d.dataset_id}.json`), JSON.stringify({ ...d, investigation: id, notes: d.notes || '' }, null, 2) + '\n');
    const pubCharts = join(root, 'public', 'charts', id);
    mkdirSync(pubCharts, { recursive: true });
    for (const c of r.charts) {
      const { file } = c;
      copyFileSync(join(r.cdir, file), join(pubCharts, file));
      const { cdir: _drop, ...meta } = c;
      writeFileSync(join(out, 'charts', `${id}-${c.slug}.json`), JSON.stringify(meta, null, 2) + '\n');
    }
    bridged.push(id);
  }
  if (failures.length) { for (const f of failures) console.error(`FAIL  ${f}`); console.error(`bridge FAILED (${failures.length}); nothing written for failing investigations`); process.exit(1); }
  writeFileSync(join(root, 'bridge.lock.json'), JSON.stringify({ lab_commit: labCommit, bridged_on: today, mode: fixtureMode ? 'fixture' : 'lab', investigations: bridged }, null, 2) + '\n');
  console.log(`bridged ${bridged.length} investigation(s) from lab ${labCommit.slice(0, 7)} (${fixtureMode ? 'fixture' : 'lab'} mode): ${bridged.join(', ') || 'none'}`);
}

main();
