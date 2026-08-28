import { saveMaterialPriceAction, toggleMaterialPriceAction } from "@/app/actions/settings";
import { toNumber } from "@/lib/money";
import type { MaterialPrice } from "@/db/schema";

/**
 * Price list editor. Rows are plain forms posting straight to server actions, so
 * this stays a server component — no client JS needed to edit prices.
 */
export default function MaterialPriceList({ materials }: { materials: MaterialPrice[] }) {
  const active = materials.filter((m) => m.active);
  const retired = materials.filter((m) => !m.active);

  return (
    <section className="card p-4 sm:p-5">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-white">
        Material price list
      </h2>
      <p className="mb-4 text-xs text-muted">
        Retiring a price hides it from the quote builder without touching quotes that already use it.
      </p>

      <form
        action={saveMaterialPriceAction}
        className="mb-5 grid gap-2 rounded-lg border border-dashed border-line p-3 sm:grid-cols-[1fr_7rem_7rem_auto]"
      >
        <input name="name" className="field" placeholder="LED neon flex" aria-label="Name" required />
        <input name="unit" className="field" placeholder="metre" aria-label="Unit" defaultValue="unit" />
        <input
          name="unitPrice"
          className="field"
          inputMode="decimal"
          placeholder="0.00"
          aria-label="Unit price"
        />
        <button type="submit" className="btn btn-primary">
          Add price
        </button>
      </form>

      {materials.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No material prices yet. Add the things you buy by the metre, sheet or unit.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-[1fr_7rem_7rem_auto]">
            <span>Name</span>
            <span>Unit</span>
            <span>Price (£)</span>
            <span />
          </div>

          {[...active, ...retired].map((material) => (
            <form
              key={material.id}
              action={saveMaterialPriceAction}
              className={`grid gap-2 rounded-lg border border-line-soft p-2 sm:grid-cols-[1fr_7rem_7rem_auto] ${
                material.active ? "" : "opacity-60"
              }`}
            >
              <input type="hidden" name="id" value={material.id} />
              <input
                name="name"
                className="field"
                defaultValue={material.name}
                aria-label="Name"
                required
              />
              <input name="unit" className="field" defaultValue={material.unit} aria-label="Unit" />
              <input
                name="unitPrice"
                className="field"
                inputMode="decimal"
                defaultValue={String(toNumber(material.unitPrice))}
                aria-label="Unit price"
              />
              <div className="flex gap-2">
                <button type="submit" className="btn">
                  Save
                </button>
                <button
                  type="submit"
                  formAction={toggleMaterialPriceAction}
                  name="active"
                  value={material.active ? "false" : "true"}
                  className="btn btn-ghost"
                >
                  {material.active ? "Retire" : "Restore"}
                </button>
              </div>
            </form>
          ))}
        </div>
      )}
    </section>
  );
}
