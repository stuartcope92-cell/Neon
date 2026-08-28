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

    /**
     * DATABASE_URL must be Supabase's *session* pooler (port 5432 on
     * `...pooler.supabase.com`), not the transaction pooler (6543).
     *
     * postgres.js pipelines queries onto each connection, which Supavisor's
     * transaction mode cannot split across server connections: as soon as two
     * queries overlap, the connection deadlocks and every request hangs until it
     * times out. Measured against this database — transaction mode wedged at 5
     * concurrent queries, session mode served 40 in 639ms. A single page load
     * issues several queries in parallel, so this is not an edge case.
     *
     * Session mode holds a server connection per client connection, so keep the
     * pool small and let idle connections go quickly.
     */
    const client = postgres(url, {
      max: 5,
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
