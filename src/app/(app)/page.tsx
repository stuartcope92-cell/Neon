import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { QUOTE_STATUSES, dashboardStats, listQuotes, type QuoteFilters } from "@/lib/quotes";
import { formatGBP } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import StatusBadge from "@/components/StatusBadge";
import QuoteFiltersBar from "@/components/QuoteFiltersBar";

export const metadata = { title: "Dashboard · Neon Quote Creator" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSession();
  const params = await searchParams;

  const statusParam = one(params.status);
  const filters: QuoteFilters = {
    q: one(params.q),
    status:
      statusParam && (QUOTE_STATUSES as string[]).includes(statusParam)
        ? (statusParam as QuoteFilters["status"])
        : "all",
    from: one(params.from),
    to: one(params.to),
    sort: (one(params.sort) as QuoteFilters["sort"]) ?? "newest",
  };

  const quotes = await listQuotes(filters);
  const stats = dashboardStats(await listQuotes({}));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Quotes</h1>
          <p className="mt-1 text-sm text-muted">
            {quotes.length} {quotes.length === 1 ? "quote" : "quotes"} matching your filters.
          </p>
        </div>
        <Link href="/quotes/new" className="btn btn-primary">
          New quote
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Quotes this month" value={String(stats.quotesThisMonth)} />
        <StatCard label="Accepted value" value={formatGBP(stats.acceptedValue)} accent />
        <StatCard label="Awaiting response" value={String(stats.awaitingResponse)} />
      </div>

      <QuoteFiltersBar
        defaults={{
          q: filters.q ?? "",
          status: filters.status ?? "all",
          from: filters.from ?? "",
          to: filters.to ?? "",
          sort: filters.sort ?? "newest",
        }}
      />

      {quotes.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-muted">
            No quotes yet. Set your hourly rate and material prices in{" "}
            <Link href="/settings" className="text-accent underline">
              Settings
            </Link>
            , then create your first quote.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line-soft text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Quote</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Sign</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr
                    key={quote.id}
                    className="border-b border-line-soft/60 last:border-0 hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/quotes/${quote.id}`} className="text-accent hover:underline">
                        {quote.quoteNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/quotes/${quote.id}`} className="font-medium text-white hover:underline">
                        {quote.customer.name}
                      </Link>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted">
                      {quote.signDescription || "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-white">
                      {formatGBP(quote.totals.total)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={quote.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {formatDate(quote.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked cards */}
          <div className="space-y-3 md:hidden">
            {quotes.map((quote) => (
              <Link key={quote.id} href={`/quotes/${quote.id}`} className="card block p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-accent">{quote.quoteNumber}</p>
                    <p className="mt-0.5 truncate font-semibold text-white">{quote.customer.name}</p>
                  </div>
                  <StatusBadge status={quote.status} />
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-muted">
                  {quote.signDescription || "No description"}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-muted">{formatDate(quote.createdAt)}</span>
                  <span className="font-semibold text-white">{formatGBP(quote.totals.total)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? "text-brand" : "text-white"}`}>{value}</p>
    </div>
  );
}
