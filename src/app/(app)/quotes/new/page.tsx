import { requireSession } from "@/lib/auth";
import { getSettings, listMaterialPrices } from "@/lib/settings";
import { searchCustomers } from "@/lib/quotes";
import QuoteBuilder from "@/components/QuoteBuilder";

export const metadata = { title: "New quote · Neon Quote Creator" };

export default async function NewQuotePage() {
  await requireSession();
  const [settings, materials, customers] = await Promise.all([
    getSettings(),
    listMaterialPrices(),
    searchCustomers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">New quote</h1>
        <p className="mt-1 text-sm text-muted">
          Prices default to your settings — every line stays editable.
        </p>
      </div>

      <QuoteBuilder
        defaults={{
          hourlyRate: settings.hourlyRate,
          vatRatePercent: settings.vatRatePercent,
          defaultTermsAndNotes: settings.defaultTermsAndNotes,
        }}
        materials={materials}
        customers={customers}
      />
    </div>
  );
}
