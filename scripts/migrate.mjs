#!/usr/bin/env node
/**
 * Applies the SQL migrations in ./drizzle.
 *   npm run db:migrate
 *
 * Uses DIRECT_URL (Supabase port 5432) rather than the transaction pooler, which
 * can't run the DDL and advisory locks a migration needs.
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!url) {
  console.error("DIRECT_URL is not set. Add it to .env.local first.");
  process.exit(1);
}

if (url.includes(":6543")) {
  console.warn("Warning: this looks like the pooled connection. Migrations want DIRECT_URL (:5432).");
}

const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
await client.end();
console.log("Migrations applied.");
