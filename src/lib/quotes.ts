import "server-only";
import { and, desc, eq, gte, ilike, inArray, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  quoteEvents,
  quoteLineItems,
  quotes,
  type QuoteStatus,
} from "@/db/schema";
import { calculateTotals, type Totals } from "./money";

export const QUOTE_STATUSES: QuoteStatus[] = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
];

export type QuoteFilters = {
  q?: string;
  status?: QuoteStatus | "all";
  from?: string;
  to?: string;
  sort?: "newest" | "oldest" | "value";
};

export type QuoteWithDetail = NonNullable<Awaited<ReturnType<typeof getQuote>>>;

export async function getQuote(id: number) {
  const quote = await db.query.quotes.findFirst({
    where: eq(quotes.id, id),
    with: {
      customer: true,
      lineItems: true,
      events: true,
    },
  });
  if (!quote) return null;
  return {
    ...quote,
    lineItems: [...quote.lineItems].sort((a, b) => a.sortOrder - b.sortOrder),
    events: [...quote.events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
  };
}

export function totalsFor(quote: {
  lineItems: Array<{ quantity: string; unitPrice: string }>;
  discountPercent: string;
  vatApplied: boolean;
  vatRatePercent: string;
}): Totals {
  return calculateTotals({
    lineItems: quote.lineItems,
    discountPercent: quote.discountPercent,
    vatApplied: quote.vatApplied,
    vatRatePercent: quote.vatRatePercent,
  });
}

export async function listQuotes(filters: QuoteFilters = {}) {
  const conditions: SQL[] = [];

  if (filters.status && filters.status !== "all") {
    conditions.push(eq(quotes.status, filters.status));
  }
  if (filters.from) {
    conditions.push(gte(quotes.createdAt, new Date(`${filters.from}T00:00:00`)));
  }
  if (filters.to) {
    conditions.push(lte(quotes.createdAt, new Date(`${filters.to}T23:59:59.999`)));
  }
  if (filters.q?.trim()) {
    const needle = `%${filters.q.trim()}%`;
    const match = or(
      ilike(customers.name, needle),
      ilike(quotes.quoteNumber, needle),
      ilike(quotes.signDescription, needle),
    );
    if (match) conditions.push(match);
  }

  const rows = await db
    .select({
      quote: quotes,
      customer: customers,
    })
    .from(quotes)
    .innerJoin(customers, eq(quotes.customerId, customers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(filters.sort === "oldest" ? quotes.createdAt : desc(quotes.createdAt))
    .limit(500);

  const quoteIds = rows.map((row) => row.quote.id);
  const items = quoteIds.length
    ? await db.select().from(quoteLineItems).where(inArray(quoteLineItems.quoteId, quoteIds))
    : [];
  const byQuote = new Map<number, Array<{ quantity: string; unitPrice: string }>>();
  for (const item of items) {
    const list = byQuote.get(item.quoteId) ?? [];
    list.push(item);
    byQuote.set(item.quoteId, list);
  }

  const withTotals = rows.map((row) => ({
    ...row.quote,
    customer: row.customer,
    totals: totalsFor({
      lineItems: byQuote.get(row.quote.id) ?? [],
      discountPercent: row.quote.discountPercent,
      vatApplied: row.quote.vatApplied,
      vatRatePercent: row.quote.vatRatePercent,
    }),
  }));

  if (filters.sort === "value") {
    withTotals.sort((a, b) => b.totals.total - a.totals.total);
  }

  return withTotals;
}

export type DashboardStats = {
  quotesThisMonth: number;
  acceptedValue: number;
  awaitingResponse: number;
};

export function dashboardStats(
  quotesWithTotals: Awaited<ReturnType<typeof listQuotes>>,
): DashboardStats {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    quotesThisMonth: quotesWithTotals.filter((q) => q.createdAt >= monthStart).length,
    acceptedValue: quotesWithTotals
      .filter((q) => q.status === "accepted")
      .reduce((sum, q) => sum + q.totals.total, 0),
    awaitingResponse: quotesWithTotals.filter((q) => q.status === "sent").length,
  };
}

export async function logQuoteEvent(quoteId: number, label: string): Promise<void> {
  await db.insert(quoteEvents).values({ quoteId, label });
}

export async function searchCustomers(term?: string) {
  if (!term?.trim()) {
    return db.select().from(customers).orderBy(customers.name).limit(100);
  }
  return db
    .select()
    .from(customers)
    .where(ilike(customers.name, `%${term.trim()}%`))
    .orderBy(customers.name)
    .limit(50);
}
