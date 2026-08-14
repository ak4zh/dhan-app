// Runs pending Drizzle migrations against the configured DB before the server
// starts. Deliberately plain JS (not TS) so it can run in the production image
// without pulling in tsx/typescript — only drizzle-orm + @libsql/client, both
// already production dependencies.
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

const rawDbPath = process.env.DB_PATH ?? 'file:./data/app.db';
const url = /^(file:|https?:|libsql:)/.test(rawDbPath) ? rawDbPath : `file:${rawDbPath}`;

const client = createClient({ url, authToken: process.env.DB_AUTH_TOKEN });
const db = drizzle(client);

console.log(`[migrate] applying pending migrations to ${url} ...`);
await migrate(db, { migrationsFolder: './drizzle' });
console.log('[migrate] done.');

client.close();
