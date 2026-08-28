import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;

let instance: Database | null = null;

function getDb(): Database {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
    }

    // Supabase's transaction pooler (Supavisor, port 6543) doesn't support prepared
    // statements, and each serverless invocation wants at most one connection.
    const client = postgres(url, {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    instance = drizzle(client, { schema });
  }
  return instance;
}

/**
 * Lazily-connected database handle. The connection is only opened on first use,
 * so `next build` doesn't need DATABASE_URL to be present.
 */
export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    const value = Reflect.get(getDb(), property, receiver);
    return typeof value === "function" ? value.bind(getDb()) : value;
  },
});

export { schema };
