import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const DB_PATH = process.env.DATABASE_PATH ?? join(process.cwd(), "data", "casino.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

/**
 * Singleton connection. Next.js dev mode re-evaluates modules on every hot
 * reload, so stash the instance on globalThis to avoid re-opening the file
 * (and leaking handles) on each edit.
 */
const globalForDb = globalThis as unknown as { casinoDb?: Database.Database };

export const db = globalForDb.casinoDb ?? new Database(DB_PATH);
db.pragma("journal_mode = WAL");

if (process.env.NODE_ENV !== "production") globalForDb.casinoDb = db;
