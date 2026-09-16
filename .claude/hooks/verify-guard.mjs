#!/usr/bin/env node
// Verification guard for Claude Code sessions in this repository (the Khaylub.com V2 pattern).
// Wired as a PreToolUse hook in .claude/settings.json. It runs only the repository's own scripts.
//
//   hook   (stdin: the tool call as JSON)
//          git commit         scan the staged files for em dashes, secrets, machine paths, secret files;
//                             if build inputs are staged, require `npm run check` and `npm run validate` to pass
//          gh pr create       require a full-verification stamp (.claude/verify-stamp.json) matching HEAD on a clean tree
//          anything else      allow
//   full   run check, validate, build:preview, validate, test:unit, test, lhci, audit; write the stamp on success
//
// Exit codes: 0 allow; 2 block (the message on stderr goes back to Claude); 1 internal failure.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
process.chdir(root);
const stampPath = join(root, '.claude', 'verify-stamp.json');
const BUILD_INPUT_PREFIXES = ['src/', 'public/', 'scripts/', 'tests/'];
const BUILD_INPUT_FILES = ['render.yaml', 'astro.config.mjs', 'package.json', 'package-lock.json', 'tsconfig.json', 'playwright.config.ts', 'lighthouserc.json', '.htmlvalidate.json', '.nvmrc', 'bridge.lock.json'];
const BINARY_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.ico', '.pdf', '.woff', '.woff2', '.zip'];
const EM_DASH = String.fromCharCode(0x2014);
// Built from fragments so this file does not itself contain the banned strings.
const PATH_PATTERNS = ['C:\\\\Users', '/Users/[A-Za-z]', ['One', 'Drive'].join(''), ['Desktop', '\\\\Projects'].join(''), ['Knowledge', ' Base'].join('')].map((b) => new RegExp(b, 'i'));
const SECRET_PATTERNS = [/ghp_[A-Za-z0-9]{20,}/, /github_pat_[A-Za-z0-9_]{20,}/, /sk-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /BEGIN (RSA |EC )?PRIVATE KEY/, /rnd_[A-Za-z0-9]{20,}/];
const SECRET_FILES = /(^|\/)(\.env(\..*)?|.*\.pem|.*\.key)$/;

const FULL_STEPS = [
  { label: 'npm run check', cmd: 'npm', args: ['run', 'check'] },
  { label: 'npm run validate', cmd: 'npm', args: ['run', 'validate'] },
  { label: 'npm run build:preview', cmd: 'npm', args: ['run', 'build:preview'] },
  { label: 'npm run validate (built output)', cmd: 'npm', args: ['run', 'validate'] },
  { label: 'npm run test:unit', cmd: 'npm', args: ['run', 'test:unit'] },
  { label: 'npm test', cmd: 'npm', args: ['test'] },
  { label: 'npm run lhci', cmd: 'npm', args: ['run', 'lhci'] },
  { label: 'npm audit --audit-level=high', cmd: 'npm', args: ['audit', '--audit-level=high'] },
];
const FAST_STEPS = FULL_STEPS.slice(0, 2);

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout;
}
function run(step) {
  const r = spawnSync(step.cmd, step.args, { encoding: 'utf8', shell: process.platform === 'win32' });
  return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') };
}
function block(msg) { process.stderr.write(msg + '\n'); process.exit(2); }

function scanStaged() {
  const files = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split('\n').filter(Boolean);
  const problems = [];
  let buildInputs = false;
  for (const f of files) {
    if (SECRET_FILES.test(f)) problems.push(`${f}: secret file must not be committed`);
    if (BUILD_INPUT_PREFIXES.some((p) => f.startsWith(p)) || BUILD_INPUT_FILES.includes(f)) buildInputs = true;
    if (BINARY_EXTS.some((e) => f.toLowerCase().endsWith(e))) continue;
    let text;
    try { text = git(['show', `:${f}`]); } catch { continue; }
    if (text.includes(EM_DASH)) problems.push(`${f}: em dash`);
    for (const re of PATH_PATTERNS) if (re.test(text)) problems.push(`${f}: machine path matches ${re}`);
    for (const re of SECRET_PATTERNS) if (re.test(text)) problems.push(`${f}: credential pattern ${re}`);
  }
  return { files, problems, buildInputs };
}

function hookMode() {
  let input = '';
  try { input = readFileSync(0, 'utf8'); } catch { process.exit(0); }
  let call;
  try { call = JSON.parse(input); } catch { process.exit(0); }
  const cmd = String(call?.tool_input?.command || '');
  if (/\bgit\s+commit\b/.test(cmd)) {
    const { files, problems, buildInputs } = scanStaged();
    if (!files.length) process.exit(0);
    if (problems.length) block(`verify-guard blocked the commit:\n  ${problems.join('\n  ')}`);
    if (buildInputs) {
      for (const step of FAST_STEPS) {
        const r = run(step);
        if (!r.ok) block(`verify-guard blocked the commit: ${step.label} failed\n${r.out.slice(-2000)}`);
      }
    }
    process.exit(0);
  }
  if (/\bgh\s+pr\s+create\b/.test(cmd)) {
    if (!existsSync(stampPath)) block('verify-guard blocked the pull request: no verification stamp. Run: node .claude/hooks/verify-guard.mjs full');
    const stamp = JSON.parse(readFileSync(stampPath, 'utf8'));
    const head = git(['rev-parse', 'HEAD']).trim();
    const dirty = git(['status', '--porcelain']).trim();
    if (stamp.head !== head || dirty) block(`verify-guard blocked the pull request: the stamp is for ${String(stamp.head).slice(0, 7)}, HEAD is ${head.slice(0, 7)}${dirty ? ', and the tree is dirty' : ''}. Run the full verification again.`);
    process.exit(0);
  }
  process.exit(0);
}

function fullMode() {
  const results = [];
  for (const step of FULL_STEPS) {
    const started = Date.now();
    const r = run(step);
    results.push({ label: step.label, ok: r.ok, seconds: Math.round((Date.now() - started) / 1000) });
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${step.label} (${results.at(-1).seconds}s)`);
    if (!r.ok) { console.log(r.out.slice(-3000)); console.log(`full verification FAILED at ${step.label}`); process.exit(1); }
  }
  const head = git(['rev-parse', 'HEAD']).trim();
  writeFileSync(stampPath, JSON.stringify({ head, at: new Date().toISOString(), steps: results }, null, 2) + '\n');
  console.log(`full verification PASS, ${results.length} of ${results.length}; stamp written for ${head.slice(0, 7)}`);
}

const mode = process.argv[2] || 'hook';
if (mode === 'full') fullMode(); else hookMode();
