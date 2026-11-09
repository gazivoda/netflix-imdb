#!/usr/bin/env node
// Writes public/data/imdb-rt-gap.csv from data/imdb-rt-gap.json: one row per included
// title, in the JSON's own order, with the gap computed by lib/research-stats.ts.
// Deterministic: same JSON in, same bytes out. No network access, nothing is invented.
//
//   node scripts/research/imdb-rt-gap-csv.mjs           # (re)write public/data/imdb-rt-gap.csv
//   node scripts/research/imdb-rt-gap-csv.mjs --check   # exit 1 if the committed CSV is stale
//   node scripts/research/imdb-rt-gap-csv.mjs --stdout  # print the CSV, write nothing
//
// Needs Node 22.18+ (it imports lib/research-stats.ts via built-in type stripping).
// Run it after scripts/research/imdb-rt-gap.mjs refreshes the JSON.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toGapRow } from '../../lib/research-stats.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = join(ROOT, 'data', 'imdb-rt-gap.json');
const OUT = join(ROOT, 'public', 'data', 'imdb-rt-gap.csv');

export const HEADER = [
  'title',
  'year',
  'type',
  'imdb_id',
  'imdb_rating',
  'imdb_votes',
  'imdb_x10',
  'rt_percent',
  'gap',
  'omdb_rt_flagged',
];

// RFC 4180 quoting: wrap in quotes when a field has a comma, quote or line break.
const cell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function buildCsv(data) {
  const flagged = new Set((data.flagged ?? []).map((f) => f.title));
  const lines = [HEADER.join(',')];
  for (const t of data.titles) {
    const g = toGapRow({ title: t.title, imdb: t.imdbRating, rt: t.rtPercent });
    lines.push(
      [
        t.title,
        t.year,
        t.type,
        t.imdbId,
        t.imdbRating.toFixed(1),
        t.imdbVotes,
        g.imdbScaled,
        t.rtPercent,
        g.gap,
        flagged.has(t.title) ? 'true' : 'false',
      ]
        .map(cell)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

const csv = buildCsv(JSON.parse(readFileSync(SRC, 'utf8')));

if (process.argv.includes('--stdout')) {
  process.stdout.write(csv);
} else if (process.argv.includes('--check')) {
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== csv) {
    console.error('public/data/imdb-rt-gap.csv is missing or stale. Run: node scripts/research/imdb-rt-gap-csv.mjs');
    process.exit(1);
  }
  console.log('public/data/imdb-rt-gap.csv is up to date.');
} else {
  writeFileSync(OUT, csv);
  console.log(`Wrote ${csv.trimEnd().split('\n').length - 1} rows to public/data/imdb-rt-gap.csv`);
}
