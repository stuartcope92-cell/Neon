"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { saveQuoteAction } from "@/app/actions/quotes";
import { calculateTotals, formatGBP, lineTotal, toNumber } from "@/lib/money";
import { addDaysISO } from "@/lib/dates";
import type { ActionState, LineItemDraft, QuoteFormPayload } from "@/lib/types";
import type { Customer, LineItemType, MaterialPrice } from "@/db/schema";

export type BuilderDefaults = {
  hourlyRate: string;
  vatRatePercent: string;
  defaultTermsAndNotes: string;
};

export type BuilderQuote = {
  id: number;
  quoteNumber: string;
  customerId: number;
  signDescription: string;
  discountPercent: string;
  vatApplied: boolean;
  vatRatePercent: string;
  validUntil: string | null;
  internalNotes: string | null;
  termsAndNotes: string;
  status: string;
  lineItems: Array<{
    id: number;
    type: LineItemType;
    description: string;
    quantity: string;
    unitPrice: string;
  }>;
};

const EMPTY_CUSTOMER = { name: "", email: "", phone: "", address: "" };

let keySeed = 0;
const nextKey = () => `row-${keySeed++}`;

export default function QuoteBuilder({
  defaults,
  materials,
  customers,
  quote,
}: {
  defaults: BuilderDefaults;
  materials: MaterialPrice[];
  customers: Customer[];
  quote?: BuilderQuote;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveQuoteAction, {});

  const [customerMode, setCustomerMode] = useState<"existing" | "new">(
    quote || customers.length > 0 ? "existing" : "new",
  );
  const [customerId, setCustomerId] = useState<number | null>(quote?.customerId ?? null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomer, setNewCustomer] = useState(EMPTY_CUSTOMER);

  const [signDescription, setSignDescription] = useState(quote?.signDescription ?? "");
  const [discountPercent, setDiscountPercent] = useState(
    quote ? String(toNumber(quote.discountPercent)) : "0",
  );
  const [vatApplied, setVatApplied] = useState(quote?.vatApplied ?? true);
  const [vatRatePercent] = useState(quote?.vatRatePercent ?? defaults.vatRatePercent);
  const [validUntil, setValidUntil] = useState(quote?.validUntil ?? addDaysISO(30));
  const [internalNotes, setInternalNotes] = useState(quote?.internalNotes ?? "");
  const [termsAndNotes, setTermsAndNotes] = useState(
    quote?.termsAndNotes || defaults.defaultTermsAndNotes,
  );

  const [rows, setRows] = useState<LineItemDraft[]>(
    quote?.lineItems.length
      ? quote.lineItems.map((item) => ({
          key: nextKey(),
          type: item.type,
          description: item.description,
          quantity: String(toNumber(item.quantity)),
          unitPrice: String(toNumber(item.unitPrice)),
        }))
      : [],
  );

  const dragIndex = useRef<number | null>(null);

  const totals = useMemo(
    () => calculateTotals({ lineItems: rows, discountPercent, vatApplied, vatRatePercent }),
    [rows, discountPercent, vatApplied, vatRatePercent],
  );

  const filteredCustomers = useMemo(() => {
    const needle = customerSearch.trim().toLowerCase();
    if (!needle) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(needle));
  }, [customers, customerSearch]);

  const payload: QuoteFormPayload = {
    quoteId: quote?.id,
    customerId: customerMode === "existing" ? customerId : null,
    newCustomer: customerMode === "new" ? newCustomer : null,
    signDescription,
    discountPercent,
    vatApplied,
    vatRatePercent,
    validUntil: validUntil || null,
    internalNotes,
    termsAndNotes,
    lineItems: rows,
    markAsSent: false,
  };

  function addRow(row: Omit<LineItemDraft, "key">) {
    setRows((current) => [...current, { ...row, key: nextKey() }]);
  }

  function updateRow(key: string, patch: Partial<LineItemDraft>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function moveRow(from: number, to: number) {
    if (to < 0 || to >= rows.length || from === to) return;
    setRows((current) => {
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function addMaterial(materialId: string) {
    const material = materials.find((m) => String(m.id) === materialId);
    if (!material) return;
    addRow({
      type: "material",
      description: material.name,
      quantity: "1",
      unitPrice: String(toNumber(material.unitPrice)),
    });
  }

  const canSubmit =
    (customerMode === "existing" && customerId !== null) ||
    (customerMode === "new" && newCustomer.name.trim().length > 0);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />

      <div className="space-y-6 lg:col-span-2">
        {/* Customer */}
        <section className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Customer</h2>
            <div className="flex rounded-lg border border-line p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setCustomerMode("existing")}
                className={`rounded-md px-3 py-1 font-semibold ${
                  customerMode === "existing" ? "bg-surface-2 text-white" : "text-muted"
                }`}
              >
                Existing
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("new")}
                className={`rounded-md px-3 py-1 font-semibold ${
                  customerMode === "new" ? "bg-surface-2 text-white" : "text-muted"
                }`}
              >
                New
              </button>
            </div>
          </div>

          {customerMode === "existing" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="customer-search">
                  Find customer
                </label>
                <input
                  id="customer-search"
                  className="field"
                  placeholder="Start typing a name..."
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="customer-select">
                  Customer
                </label>
                <select
                  id="customer-select"
                  className="field"
                  value={customerId ?? ""}
                  onChange={(event) =>
                    setCustomerId(event.target.value ? Number(event.target.value) : null)
                  }
                >
                  <option value="">Select a customer...</option>
                  {filteredCustomers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {customers.length === 0 ? (
                  <p className="mt-2 text-xs text-muted">
                    No customers yet &mdash; switch to &ldquo;New&rdquo; to add one.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="new-name">
                  Name
                </label>
                <input
                  id="new-name"
                  className="field"
                  value={newCustomer.name}
                  onChange={(event) => setNewCustomer({ ...newCustomer, name: event.target.value })}
                  placeholder="Bar Luna Ltd"
                />
              </div>
              <div>
                <label className="label" htmlFor="new-email">
                  Email
                </label>
                <input
                  id="new-email"
                  type="email"
                  className="field"
                  value={newCustomer.email}
                  onChange={(event) => setNewCustomer({ ...newCustomer, email: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="new-phone">
                  Phone
                </label>
                <input
                  id="new-phone"
                  className="field"
                  value={newCustomer.phone}
                  onChange={(event) => setNewCustomer({ ...newCustomer, phone: event.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="new-address">
                  Address
                </label>
                <input
                  id="new-address"
                  className="field"
                  value={newCustomer.address}
                  onChange={(event) =>
                    setNewCustomer({ ...newCustomer, address: event.target.value })
                  }
                />
              </div>
            </div>
          )}
        </section>

        {/* Sign description */}
        <section className="card p-4 sm:p-5">
          <label className="label" htmlFor="sign-description">
            Sign description
          </label>
          <textarea
            id="sign-description"
            className="field min-h-24"
            value={signDescription}
            onChange={(event) => setSignDescription(event.target.value)}
            placeholder="Custom 'Open' script sign, 60cm wide, pink LED neon flex on clear acrylic backing."
          />
        </section>

        {/* Line items */}
        <section className="card p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">Line items</h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  addRow({
                    type: "labour",
                    description: "Labour",
                    quantity: "1",
                    unitPrice: String(toNumber(defaults.hourlyRate)),
                  })
                }
              >
                + Labour
              </button>
              <select
                className="field w-auto"
                value=""
                onChange={(event) => {
                  addMaterial(event.target.value);
                  event.target.value = "";
                }}
                aria-label="Add material"
              >
                <option value="">+ Material...</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name} ({formatGBP(toNumber(material.unitPrice))}/{material.unit})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  addRow({ type: "custom", description: "", quantity: "1", unitPrice: "0" })
                }
              >
                + Custom
              </button>
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
              No line items yet. Add labour hours, materials from your price list, or a custom line.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="hidden gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted sm:grid sm:grid-cols-[1.5rem_1fr_5.5rem_7rem_6rem_2rem]">
                <span />
                <span>Description</span>
                <span>Qty</span>
                <span>Unit price</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {rows.map((row, index) => (
                <div
                  key={row.key}
                  draggable
                  onDragStart={() => {
                    dragIndex.current = index;
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragIndex.current !== null) moveRow(dragIndex.current, index);
                    dragIndex.current = null;
                  }}
                  className="grid items-center gap-2 rounded-lg border border-line-soft bg-ink/40 p-2 sm:grid-cols-[1.5rem_1fr_5.5rem_7rem_6rem_2rem]"
                >
                  <div className="flex items-center gap-1 sm:flex-col sm:gap-0">
                    <button
                      type="button"
                      className="px-1 text-xs text-muted hover:text-white"
                      onClick={() => moveRow(index, index - 1)}
                      aria-label="Move line up"
                    >
                      &#9650;
                    </button>
                    <button
                      type="button"
                      className="px-1 text-xs text-muted hover:text-white"
                      onClick={() => moveRow(index, index + 1)}
                      aria-label="Move line down"
                    >
                      &#9660;
                    </button>
                    <span className="ml-auto text-[10px] uppercase text-muted sm:hidden">
                      {row.type}
                    </span>
                  </div>

                  <input
                    className="field"
                    value={row.description}
                    placeholder={row.type === "labour" ? "Labour" : "Description"}
                    onChange={(event) => updateRow(row.key, { description: event.target.value })}
                    aria-label="Description"
                  />

                  <div className="grid grid-cols-2 gap-2 sm:contents">
                    <input
                      className="field"
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                      aria-label={row.type === "labour" ? "Hours" : "Quantity"}
                      placeholder={row.type === "labour" ? "hrs" : "qty"}
                    />
                    <input
                      className="field"
                      inputMode="decimal"
                      value={row.unitPrice}
                      onChange={(event) => updateRow(row.key, { unitPrice: event.target.value })}
                      aria-label="Unit price"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="text-right text-sm font-semibold text-white">
                    {formatGBP(lineTotal(row.quantity, row.unitPrice))}
                  </div>

                  <button
                    type="button"
                    className="justify-self-end px-2 text-muted hover:text-danger"
                    onClick={() => removeRow(row.key)}
                    aria-label="Remove line"
                  >
                    &#10005;
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Internal notes */}
        <section className="card p-4 sm:p-5">
          <label className="label" htmlFor="internal-notes">
            Internal notes (never printed on the PDF)
          </label>
          <textarea
            id="internal-notes"
            className="field min-h-20"
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
            placeholder="Supplier lead time, install access, anything the customer shouldn't see."
          />
        </section>

        <section className="card p-4 sm:p-5">
          <label className="label" htmlFor="terms">
            Terms &amp; notes on this quote
          </label>
          <textarea
            id="terms"
            className="field min-h-24"
            value={termsAndNotes}
            onChange={(event) => setTermsAndNotes(event.target.value)}
          />
          <p className="mt-2 text-xs text-muted">
            Pre-filled from Settings. Edits here only affect this quote.
          </p>
        </section>
      </div>

      {/* Totals / actions */}
      <div className="lg:col-span-1">
        <div className="card space-y-4 p-4 sm:p-5 lg:sticky lg:top-24">
          <h2 className="text-sm font-bold uppercase tracking-wide text-white">Totals</h2>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <label className="label" htmlFor="discount">
                Discount %
              </label>
              <input
                id="discount"
                className="field"
                inputMode="decimal"
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="valid-until">
                Valid until
              </label>
              <input
                id="valid-until"
                type="date"
                className="field"
                value={validUntil ?? ""}
                onChange={(event) => setValidUntil(event.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vatApplied}
              onChange={(event) => setVatApplied(event.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            Apply VAT at {toNumber(vatRatePercent)}%
          </label>

          <dl className="space-y-2 border-t border-line-soft pt-4 text-sm">
            <TotalRow label="Subtotal" value={formatGBP(totals.subtotal)} />
            {totals.discount > 0 ? (
              <TotalRow
                label={`Discount (${toNumber(discountPercent)}%)`}
                value={`-${formatGBP(totals.discount)}`}
              />
            ) : null}
            {vatApplied ? (
              <TotalRow label={`VAT (${toNumber(vatRatePercent)}%)`} value={formatGBP(totals.vat)} />
            ) : (
              <TotalRow label="VAT" value="Not applied" />
            )}
            <div className="flex items-center justify-between border-t border-line-soft pt-3">
              <dt className="font-semibold text-white">Total</dt>
              <dd className="text-xl font-bold text-brand">{formatGBP(totals.total)}</dd>
            </div>
          </dl>

          {state.error ? (
            <p
              role="alert"
              className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
            >
              {state.error}
            </p>
          ) : null}

          <div className="space-y-2">
            <SaveButton
              name="markAsSent"
              value="false"
              className="btn w-full"
              label="Save as draft"
              disabled={!canSubmit}
            />
            <SaveButton
              name="markAsSent"
              value="true"
              className="btn btn-primary w-full"
              label={!quote || quote.status === "draft" ? "Save & mark as sent" : "Save changes"}
              disabled={!canSubmit}
            />
            <Link href={quote ? `/quotes/${quote.id}` : "/"} className="btn btn-ghost w-full">
              Cancel
            </Link>
          </div>
          {!canSubmit ? (
            <p className="text-xs text-muted">Choose or name a customer to save this quote.</p>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-body">{value}</dd>
    </div>
  );
}

function SaveButton({
  label,
  className,
  disabled,
  ...rest
}: {
  label: string;
  className: string;
  disabled?: boolean;
  name: string;
  value: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} {...rest}>
      {pending ? "Saving..." : label}
    </button>
  );
}
