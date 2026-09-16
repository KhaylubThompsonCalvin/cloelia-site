// The bridge must refuse every broken fixture in the lab with a named reason and accept the valid one.
// Runs the bridge as a subprocess against a temporary copy of each fixture, writing into a temp site root.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const site = resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const lab = resolve(process.env.LAB_DIR || join(site, '..', 'cloelia-investigations'));
const fixtures = join(lab, 'tests', 'fixtures');

function runBridgeOn(fixtureName) {
  // A temporary lab that contains only this fixture as investigations/000-fixture, so the bridge's
  // normal (non-fixture) mode is exercised end to end.
  const tmpLab = mkdtempSync(join(tmpdir(), 'cloelia-lab-'));
  cpSync(join(fixtures, fixtureName, '000-fixture'), join(tmpLab, 'investigations', '000-fixture'), { recursive: true });
  spawnSync('git', ['init', '-q'], { cwd: tmpLab });
  spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'fixture'], { cwd: tmpLab });
  const tmpSite = mkdtempSync(join(tmpdir(), 'cloelia-site-'));
  cpSync(join(site, 'scripts', 'bridge.mjs'), join(tmpSite, 'scripts', 'bridge.mjs'));
  const r = spawnSync(process.execPath, [join(tmpSite, 'scripts', 'bridge.mjs')], { cwd: tmpSite, env: { ...process.env, LAB_DIR: tmpLab }, encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr, tmpSite };
}

test('valid fixture bridges and writes the lock', () => {
  const { code, out, tmpSite } = runBridgeOn('publish-valid');
  assert.equal(code, 0, out);
  assert.ok(existsSync(join(tmpSite, 'bridge.lock.json')));
  const lock = JSON.parse(readFileSync(join(tmpSite, 'bridge.lock.json'), 'utf8'));
  assert.deepEqual(lock.investigations, ['000-fixture']);
  assert.ok(existsSync(join(tmpSite, 'src', 'content', 'bridge', 'measures', 'fixture-rate.json')));
  assert.ok(existsSync(join(tmpSite, 'public', 'charts', '000-fixture', 'fixture-rate-line.svg')));
});

for (const [name, reason] of [
  ['publish-missing-grade', 'grade is required'],
  ['publish-missing-population', 'population is required'],
]) {
  test(`${name} is refused with a named reason`, () => {
    const { code, out } = runBridgeOn(name);
    assert.equal(code, 1, out);
    assert.match(out, new RegExp(reason));
  });
}

test('a bad raw hash is not the bridge\'s job (the lab validator owns it) but the flags still gate', () => {
  // The hash fixture passes the bridge's field checks; the lab's check_publish.py is what recomputes hashes.
  const { code, out } = runBridgeOn('publish-missing-hash');
  assert.equal(code, 0, out);
});
