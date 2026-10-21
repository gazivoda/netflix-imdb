#!/usr/bin/env node
// Fails when the packaged extension is stale or inconsistent:
//   1. extension.zip and public/downloads/rating-watch-extension.zip must hold the same files
//      with the same contents (zip metadata such as timestamps is ignored), and
//   2. both must match the extension/ directory (file list and bytes).
// Directory entries and ordering are ignored. Uses the system `unzip`, no dependencies.
// Fix a failure with: bash scripts/package-extension.sh
// ZIP_CHECK_ROOT overrides the repo root (used to test this script against copies).

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.ZIP_CHECK_ROOT || join(dirname(fileURLToPath(import.meta.url)), '..');
const ZIPS = ['extension.zip', 'public/downloads/rating-watch-extension.zip'];
const EXCLUDED = (rel) => rel.split('/').some((p) => p === '.DS_Store' || p === '.git' || p === 'node_modules');
const sha = (buf) => createHash('sha256').update(buf).digest('hex');

function fromZip(zipPath) {
  const opts = { maxBuffer: 256 * 1024 * 1024 };
  const names = execFileSync('unzip', ['-Z1', zipPath], { ...opts, encoding: 'utf8' })
    .split('\n')
    .filter((n) => n && !n.endsWith('/') && !EXCLUDED(n));
  return new Map(names.map((n) => [n, sha(execFileSync('unzip', ['-p', zipPath, n], opts))]));
}

function fromDir(dir) {
  const out = new Map();
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const full = join(d, name);
      const rel = relative(dir, full).split(sep).join('/');
      if (EXCLUDED(rel)) continue;
      if (statSync(full).isDirectory()) walk(full);
      else out.set(rel, sha(readFileSync(full)));
    }
  };
  walk(dir);
  return out;
}

function diff(label, expected, actual) {
  const problems = [];
  for (const [n, h] of expected) {
    if (!actual.has(n)) problems.push(`${label}: missing ${n}`);
    else if (actual.get(n) !== h) problems.push(`${label}: content differs ${n}`);
  }
  for (const n of actual.keys()) if (!expected.has(n)) problems.push(`${label}: extra ${n}`);
  return problems;
}

const extDir = join(ROOT, 'extension');
const problems = [];
if (!existsSync(extDir)) problems.push('extension/ directory not found');
for (const z of ZIPS) if (!existsSync(join(ROOT, z))) problems.push(`${z} not found`);

if (problems.length === 0) {
  const source = fromDir(extDir);
  const [a, b] = ZIPS.map((z) => fromZip(join(ROOT, z)));
  problems.push(...diff(`${ZIPS[0]} vs extension/`, source, a));
  problems.push(...diff(`${ZIPS[1]} vs extension/`, source, b));
  problems.push(...diff(`${ZIPS[1]} vs ${ZIPS[0]}`, a, b));
  if (problems.length === 0) console.log(`OK: both zips match extension/ (${source.size} files)`);
}

if (problems.length > 0) {
  console.error('Extension zip check FAILED:');
  for (const p of problems) console.error(`  - ${p}`);
  console.error('Run: bash scripts/package-extension.sh, then commit extension.zip and public/downloads/.');
  process.exit(1);
}
