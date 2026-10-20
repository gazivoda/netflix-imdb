// Seeds one fixture user into the local users database and prints a session cookie for it.
// Usage: JWT_SECRET=<32+ chars> node scripts/dev-seed-user.mjs --status trial|active|expired|cancelled
// The database path comes from USERS_DB_PATH (default .data/users.db). Refuses to run when NODE_ENV=production.

import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const require = createRequire(import.meta.url);

// lib/*.ts is shared with the app; transpile on the fly instead of duplicating it.
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', moduleResolution: 'node' },
});
const { seedUser } = require(join(root, 'lib/billing/dev-seed.ts'));

const STATUSES = ['trial', 'active', 'expired', 'cancelled'];
const flag = process.argv.indexOf('--status');
const status = flag > -1 ? process.argv[flag + 1] : 'trial';
if (!STATUSES.includes(status)) {
  console.error(`dev-seed-user: --status must be one of ${STATUSES.join(', ')}`);
  process.exit(1);
}

try {
  const { user, cookie } = seedUser({
    nodeEnv: process.env.NODE_ENV,
    status,
    dbFile: process.env.USERS_DB_PATH ?? '.data/users.db',
    jwtSecret: process.env.JWT_SECRET,
  });
  console.log(cookie);
  console.log(
    JSON.stringify(
      {
        id: user.id,
        subscription_status: user.subscription_status,
        subscription_plan: user.subscription_plan,
        trial_end_date: user.trial_end_date,
      },
      null,
      2,
    ),
  );
} catch (err) {
  console.error(`dev-seed-user: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
