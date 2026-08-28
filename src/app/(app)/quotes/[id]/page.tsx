import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { requireSession } from "@/lib/auth";
import { getQuote, totalsFor } from "@/lib/quotes";
import { getSettings } from "@/lib/settings";
import { formatGBP, formatQuantity, lineTotal, toNumber } from "@/lib/money";
import { formatDate, formatDateTime, isPastISO } from "@/lib/dates";
import StatusBadge from "@/components/StatusBadge";
import StatusChanger from "@/components/StatusChanger";
import { duplicateQuoteAction } from "@/app/actions/quotes";

export const metadata = { title: "Quote · Neon Quote Creator" };

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const quoteId = Number(id);
  if (!Number.isInteger(quoteId)) notFound();

  const [quote, settings] = await Promise.all([getQuote(quoteId), getSettings()]);
  if (!quote) notFound();

  const totals = totalsFor(quote);
  const expired = isPastISO(quote.validUntil) && quote.status === "sent";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-white">{quote.quoteNumber}</h1>
            <StatusBadge status={quote.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {quote.customer.name} · created {formatDate(quote.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/quotes/${quote.id}/pdf`}
            className="btn btn-primary"
            target="_blank"
            rel="noopener"
          >
            Download PDF
          </a>
          <Link href={`/quotes/${quote.id}/edit`} className="btn">
            Edit
          </Link>
          <form action={duplicateQuoteAction}>
            <input type="hidden" name="quoteId" value={quote.id} />
            <button type="submit" className="btn">
              Duplicate
            </button>
          </form>
        </div>
      </div>

      {expired ? (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          This quote passed its valid-until date ({formatDate(quote.validUntil)}) and is still marked
          as sent.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Customer-facing preview */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line-soft p-5">
              <div>
                {settings.logoUrl ? (
                  <Image
                    src={settings.logoUrl}
                    alt={settings.companyName || "Company logo"}
                    width={110}
                    height={140}
                    className="mb-3 h-20 w-auto object-contain"
                    unoptimized
                  />
                ) : null}
                <p className="text-lg font-bold text-white">
                  {settings.companyName || "Your company"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {[settings.addressLine1, settings.addressLine2, settings.city, settings.postcode]
                    .filter(Boolean)
                    .join(", ") || "Add your address in Settings"}
                  <br />
                  {[settings.phone, settings.email, settings.website].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="text-right text-xs text-muted">
                <p>
                  Quote <span className="font-mono text-body">{quote.quoteNumber}</span>
                </p>
                <p className="mt-1">Issued {formatDate(quote.createdAt)}</p>
                <p>Valid until {formatDate(quote.validUntil)}</p>
              </div>
            </div>

            <div className="grid gap-4 border-b border-line-soft p-5 sm:grid-cols-2">
              <div>
                <p className="label">Quote for</p>
                <p className="text-sm font-semibold text-white">{quote.customer.name}</p>
                <p className="text-xs leading-5 text-muted">
                  {[quote.customer.address, quote.customer.email, quote.customer.phone]
                    .filter(Boolean)
                    .join(" · ") || "No contact details on file"}
                </p>
              </div>
              <div>
                <p className="label">Sign</p>
                <p className="text-sm text-body">{quote.signDescription || "—"}</p>
              </div>
            </div>

            <div className="overflow-x-auto p-5">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-line-soft">
                    <th className="py-2 font-semibold">Description</th>
                    <th className="py-2 text-right font-semibold">Qty</th>
                    <th className="py-2 text-right font-semibold">Unit price</th>
                    <th className="py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted">
                        No line items on this quote yet.
                      </td>
                    </tr>
                  ) : (
                    quote.lineItems.map((item) => (
                      <tr key={item.id} className="border-b border-line-soft/60 last:border-0">
                        <td className="py-2 pr-4">{item.description}</td>
                        <td className="py-2 text-right text-muted">
                          {formatQuantity(toNumber(item.quantity))}
                        </td>
                        <td className="py-2 text-right text-muted">
                          {formatGBP(toNumber(item.unitPrice))}
                        </td>
                        <td className="py-2 text-right font-medium text-white">
                          {formatGBP(lineTotal(item.quantity, item.unitPrice))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <dl className="ml-auto mt-4 w-full max-w-xs space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd>{formatGBP(totals.subtotal)}</dd>
                </div>
                {totals.discount > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-muted">
                      Discount ({formatQuantity(toNumber(quote.discountPercent))}%)
                    </dt>
                    <dd>-{formatGBP(totals.discount)}</dd>
                  </div>
                ) : null}
                {quote.vatApplied ? (
                  <div className="flex justify-between">
                    <dt className="text-muted">
                      VAT ({formatQuantity(toNumber(quote.vatRatePercent))}%)
                    </dt>
                    <dd>{formatGBP(totals.vat)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-line-soft pt-2">
                  <dt className="font-semibold text-white">Total</dt>
                  <dd className="text-lg font-bold text-bulb">{formatGBP(totals.total)}</dd>
                </div>
              </dl>

              {quote.termsAndNotes ? (
                <p className="mt-6 whitespace-pre-wrap border-t border-line-soft pt-4 text-xs leading-5 text-muted">
                  {quote.termsAndNotes}
                </p>
              ) : null}
            </div>
          </section>

          {quote.internalNotes ? (
            <section className="card p-5">
              <p className="label">Internal notes — not shown to the customer</p>
              <p className="whitespace-pre-wrap text-sm text-body">{quote.internalNotes}</p>
            </section>
          ) : null}
        </div>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">Status</h2>
            <StatusChanger quoteId={quote.id} status={quote.status} />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-white">Timeline</h2>
            <ol className="space-y-3 text-sm">
              {quote.events.length === 0 ? (
                <li className="text-muted">Created {formatDateTime(quote.createdAt)}</li>
              ) : (
                quote.events.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                    <span>
                      <span className="block text-body">{event.label}</span>
                      <span className="text-xs text-muted">{formatDateTime(event.createdAt)}</span>
                    </span>
                  </li>
                ))
              )}
            </ol>
            <p className="mt-4 border-t border-line-soft pt-3 text-xs text-muted">
              Last updated {formatDateTime(quote.updatedAt)}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
