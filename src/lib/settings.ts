import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { materialPrices, settings, type Settings } from "@/db/schema";

const SETTINGS_ID = 1;

/** Reads the singleton settings row, creating it with defaults on first run. */
export async function getSettings(): Promise<Settings> {
  const existing = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1);
  if (existing[0]) return existing[0];

  await db.insert(settings).values({ id: SETTINGS_ID }).onConflictDoNothing();
  const created = await db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).limit(1);
  return created[0];
}

export async function updateSettings(values: Partial<Omit<Settings, "id">>): Promise<void> {
  await getSettings();
  await db
    .update(settings)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(settings.id, SETTINGS_ID));
}

/**
 * Reserves the next quote number atomically (single UPDATE ... RETURNING), so two
 * quotes created at the same moment can never share a number.
 */
export async function reserveQuoteNumber(): Promise<string> {
  await getSettings();
  const [row] = await db
    .update(settings)
    .set({ nextQuoteNumber: sql`${settings.nextQuoteNumber} + 1` })
    .where(eq(settings.id, SETTINGS_ID))
    .returning({ number: settings.nextQuoteNumber, prefix: settings.quoteNumberPrefix });

  // `returning` gives the post-increment value, so the reserved number is n - 1.
  const reserved = row.number - 1;
  return `${row.prefix ?? ""}${String(reserved).padStart(4, "0")}`;
}

export async function listMaterialPrices(includeInactive = false) {
  const rows = await db.select().from(materialPrices).orderBy(materialPrices.name);
  return includeInactive ? rows : rows.filter((r) => r.active);
}
