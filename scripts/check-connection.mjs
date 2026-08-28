#!/usr/bin/env node
/**
 * Verifies that the app is correctly wired to Supabase.
 *   npm run db:check
 *
 * Checks both connection strings, reports which migrations have been applied,
 * confirms RLS is on, and checks the storage bucket. Prints what to fix rather
 * than just failing.
 */
import postgres from "postgres";
import { readdirSync } from "node:fs";

const PASS = "✓";
const FAIL = "✗";
const WARN = "!";

let failures = 0;

function ok(message) {
  console.log(`  ${PASS} ${message}`);
}
function bad(message, fix) {
  failures += 1;
  console.log(`  ${FAIL} ${message}`);
  if (fix) console.log(`      -> ${fix}`);
}
function warn(message, fix) {
  console.log(`  ${WARN} ${message}`);
  if (fix) console.log(`      -> ${fix}`);
}

function describe(url) {
  try {
    const parsed = new URL(url);
    return { host: parsed.hostname, port: parsed.port || "5432" };
  } catch {
    return null;
  }
}

/** Supabase surfaces the same few problems over and over; translate them. */
function explain(error) {
  const message = String(error?.message ?? error);
  if (/password authentication failed|SASL/i.test(message)) {
    return "Wrong database password. Reset it in Supabase -> Project Settings -> Database.";
  }
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(message)) {
    return "Host not found. Copy the string again from the Supabase Connect dialog.";
  }
  if (/\[YOUR-PASSWORD\]|YOUR-PASSWORD/i.test(message)) {
    return "The placeholder [YOUR-PASSWORD] is still in the connection string.";
  }
  if (/timeout|ETIMEDOUT/i.test(message)) {
    return "Connection timed out — check the project isn't paused in Supabase.";
  }
  return message;
}

async function checkConnection(label, url, { expectedPort, prepare }) {
  console.log(`\n${label}`);

  if (!url) {
    bad(`${label} is not set`, "Add it to .env.local (see .env.example).");
    return null;
  }
  if (url.includes("[YOUR-PASSWORD]")) {
    bad("Still contains the [YOUR-PASSWORD] placeholder", "Paste your real database password in.");
    return null;
  }

  const parts = describe(url);
  if (!parts) {
    bad("Not a valid connection string");
    return null;
  }
  if (parts.port !== expectedPort) {
    warn(
      `Port is ${parts.port}, expected ${expectedPort}`,
      expectedPort === "6543"
        ? "DATABASE_URL should be the transaction pooler (:6543)."
        : "DIRECT_URL should be the direct connection (:5432).",
    );
  }

  const sql = postgres(url, { prepare, max: 1, connect_timeout: 15, onnotice: () => {} });
  try {
    const [row] = await sql`select current_user as user, current_database() as db`;
    ok(`Connected to ${parts.host}:${parts.port} as ${row.user}`);
    return sql;
  } catch (error) {
    bad(`Could not connect to ${parts.host}:${parts.port}`, explain(error));
    await sql.end({ timeout: 0 }).catch(() => {});
    return null;
  }
}

console.log("Checking Supabase wiring...");

const runtime = await checkConnection("DATABASE_URL (app runtime, pooled)", process.env.DATABASE_URL, {
  expectedPort: "6543",
  prepare: false,
});
if (runtime) await runtime.end({ timeout: 0 }).catch(() => {});

const direct = await checkConnection("DIRECT_URL (migrations)", process.env.DIRECT_URL, {
  expectedPort: "5432",
  prepare: true,
});

if (direct) {
  console.log("\nSchema");
  try {
    const expected = [
      "settings",
      "material_prices",
      "customers",
      "quotes",
      "quote_line_items",
      "quote_events",
    ];
    const tables = await direct`
      select c.relname as name, c.relrowsecurity as rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
    `;
    const found = new Map(tables.map((t) => [t.name, t.rls]));
    const missing = expected.filter((name) => !found.has(name));

    if (missing.length === expected.length) {
      bad("No application tables found", "Run: npm run db:migrate");
    } else if (missing.length) {
      bad(`Missing tables: ${missing.join(", ")}`, "Run: npm run db:migrate");
    } else {
      ok(`All ${expected.length} tables present`);

      const unprotected = expected.filter((name) => found.get(name) === false);
      if (unprotected.length) {
        bad(
          `RLS is off for: ${unprotected.join(", ")}`,
          "Run: npm run db:migrate (applies drizzle/0001_enable_rls.sql)",
        );
      } else {
        ok("Row-level security enabled on every table");
      }
    }

    const applied = await direct`
      select count(*)::int as count from drizzle.__drizzle_migrations
    `.catch(() => [{ count: 0 }]);
    const onDisk = readdirSync("./drizzle").filter((f) => f.endsWith(".sql")).length;
    if (applied[0].count >= onDisk) {
      ok(`Migrations applied: ${applied[0].count} of ${onDisk}`);
    } else {
      bad(`Migrations applied: ${applied[0].count} of ${onDisk}`, "Run: npm run db:migrate");
    }
  } catch (error) {
    bad("Could not inspect the schema", explain(error));
  }
  await direct.end({ timeout: 0 }).catch(() => {});
}

console.log("\nStorage (company logo)");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.SUPABASE_STORAGE_BUCKET || "branding";

if (!supabaseUrl || !serviceKey) {
  warn(
    "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set",
    "Optional — only needed to upload a logo on /settings.",
  );
} else {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;

    const bucket = data.find((b) => b.name === bucketName);
    if (!bucket) {
      bad(
        `Bucket "${bucketName}" not found`,
        `Create a public bucket called "${bucketName}" in Supabase -> Storage.`,
      );
    } else if (!bucket.public) {
      bad(
        `Bucket "${bucketName}" is private`,
        "Make it public, or logos won't render in the app or on PDFs.",
      );
    } else {
      ok(`Public bucket "${bucketName}" ready`);
    }
  } catch (error) {
    bad("Could not reach Supabase Storage", explain(error));
  }
}

console.log(
  failures === 0
    ? "\nAll checks passed — you're linked up.\n"
    : `\n${failures} check(s) failed. Fix the items above and run npm run db:check again.\n`,
);
process.exit(failures === 0 ? 0 : 1);
