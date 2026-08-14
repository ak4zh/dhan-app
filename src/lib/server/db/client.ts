import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const rawDbPath = process.env.DB_PATH ?? 'file:./data/app.db';

// Ensure file paths have the file: prefix expected by @libsql/client if not using HTTP/libsql protocol
const url =
	rawDbPath.startsWith('file:') ||
	rawDbPath.startsWith('http:') ||
	rawDbPath.startsWith('https:') ||
	rawDbPath.startsWith('libsql:')
		? rawDbPath
		: `file:${rawDbPath}`;

const client = createClient({
	url,
	authToken: process.env.DB_AUTH_TOKEN
});

export const db = drizzle(client, { schema });

