#!/usr/bin/env node
// Pre-launch check for turning billing on. Reads the environment of the shell it runs in (export the production
// values first; it never reads .env files) and the legal constants, which it reads as text from lib/content.ts.
//   node scripts/billing-readiness.mjs        # exits 1 when billing is on and something still blocks launch
// (Node >= 22.18 / 23.6 strips TypeScript types natively, hence the .ts import of lib/billing/readiness.ts.)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node warns that the .ts file has no package "type"; harmless, so keep output clean.
process.removeAllListeners('warning');
const { billingReadiness } = await import('../lib/billing/readiness.ts');

// lib/content.ts imports other modules without file extensions, which native TypeScript stripping cannot resolve,
// so read the three string constants from its source instead of importing it.
const content = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'content.ts'), 'utf8');
const constant = (name) => new RegExp(`export const ${name}: string = '((?:[^'\\\\]|\\\\.)*)'`).exec(content)?.[1] ?? '';
const LEGAL_ENTITY = constant('LEGAL_ENTITY');
const LEGAL_ADDRESS = constant('LEGAL_ADDRESS');
const GOVERNING_LAW = constant('GOVERNING_LAW');

const { billingOn, blockers, warnings } = billingReadiness(process.env, {
  entity: LEGAL_ENTITY,
  address: LEGAL_ADDRESS,
  governingLaw: GOVERNING_LAW,
});

console.log(`Billing: ${billingOn ? 'ON for this build' : 'off for this build'}`);
for (const w of warnings) console.log(`  warning: ${w}`);
for (const b of blockers) console.log(`  BLOCKER: ${b}`);
if (blockers.length) {
  console.log(`\n${blockers.length} blocker(s). Do not announce paid plans yet.`);
  process.exit(1);
}
console.log(billingOn ? '\nNo blockers.' : '\nNothing to block while billing is off.');
