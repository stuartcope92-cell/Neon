import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getSettings, listMaterialPrices } from "@/lib/settings";
import { getQuote, searchCustomers } from "@/lib/quotes";
import QuoteBuilder from "@/components/QuoteBuilder";

export const metadata = { title: "Edit quote · Neon Quote Creator" };

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const quoteId = Number(id);
  if (!Number.isInteger(quoteId)) notFound();

  const [quote, settings, materials, customers] = await Promise.all([
    getQuote(quoteId),
    getSettings(),
    listMaterialPrices(),
    searchCustomers(),
  ]);
  if (!quote) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Edit <span className="font-mono text-brand">{quote.quoteNumber}</span>
          </h1>
          <p className="mt-1 text-sm text-muted">{quote.customer.name}</p>
        </div>
        <Link href={`/quotes/${quote.id}`} className="btn btn-ghost">
          Back to quote
        </Link>
      </div>

      <QuoteBuilder
        defaults={{
          hourlyRate: settings.hourlyRate,
          vatRatePercent: settings.vatRatePercent,
          defaultTermsAndNotes: settings.defaultTermsAndNotes,
        }}
        materials={materials}
        customers={customers}
        quote={{
          id: quote.id,
          quoteNumber: quote.quoteNumber,
          customerId: quote.customerId,
          signDescription: quote.signDescription,
          discountPercent: quote.discountPercent,
          vatApplied: quote.vatApplied,
          vatRatePercent: quote.vatRatePercent,
          validUntil: quote.validUntil,
          internalNotes: quote.internalNotes,
          termsAndNotes: quote.termsAndNotes,
          status: quote.status,
          lineItems: quote.lineItems.map((item) => ({
            id: item.id,
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        }}
      />
    </div>
  );
}
