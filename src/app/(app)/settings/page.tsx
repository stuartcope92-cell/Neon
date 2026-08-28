import { requireSession } from "@/lib/auth";
import { getSettings, listMaterialPrices } from "@/lib/settings";
import SettingsForm from "@/components/SettingsForm";
import MaterialPriceList from "@/components/MaterialPriceList";

export const metadata = { title: "Settings · Neon Quote Creator" };

export default async function SettingsPage() {
  await requireSession();
  const [settings, materials] = await Promise.all([getSettings(), listMaterialPrices(true)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Changes apply to new quotes. Quotes you have already created keep the rates and terms they
          were built with.
        </p>
      </div>

      <SettingsForm settings={settings} />
      <MaterialPriceList materials={materials} />
    </div>
  );
}
