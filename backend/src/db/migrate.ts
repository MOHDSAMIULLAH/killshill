import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import path from 'path';

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set in .env');
  process.exit(1);
}

// The Neon HTTP SQL API requires the DIRECT (non-pooler) connection string.
// Pooler URLs contain "-pooler" in the hostname and will fail with fetch errors.
// In your Neon dashboard: disable "Connection pooling" to get the direct URL.
const rawUrl = process.env.DATABASE_URL;
if (rawUrl.includes('-pooler')) {
  console.warn(
    '\nWarning: DATABASE_URL appears to be a pooler URL (contains "-pooler").\n' +
    'The Neon HTTP API requires the direct connection string.\n' +
    'In your Neon dashboard \u2192 Connection Details, toggle off "Connection pooling".\n'
  );
}

// Uses Neon HTTP API (HTTPS port 443) — no TCP/WebSocket needed.
const sql = neon(rawUrl);
const db = drizzle(sql);

console.log('Applying migrations via Neon HTTP driver...');

migrate(db, { migrationsFolder: path.join(__dirname, '../../drizzle') })
  .then(() => {
    console.log('Migrations applied successfully.');
    process.exit(0);
  })
  .catch((err: Error) => {
    console.error('Migration failed:', err.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cause = (err as any).cause;
    if (cause) console.error('Cause:', cause?.message || cause);
    process.exit(1);
  });
