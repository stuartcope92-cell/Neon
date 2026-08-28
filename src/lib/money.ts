/** Money helpers. Everything is GBP and rounded to whole pence at each step. */

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Parses a numeric column (drizzle returns `numeric` as a string) or user input. */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

export function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export type TotalsInput = {
  lineItems: Array<{ quantity: string | number; unitPrice: string | number }>;
  discountPercent: string | number;
  vatApplied: boolean;
  vatRatePercent: string | number;
};

export type Totals = {
  subtotal: number;
  discount: number;
  netTotal: number;
  vat: number;
  total: number;
};

export function calculateTotals(input: TotalsInput): Totals {
  const subtotal = round2(
    input.lineItems.reduce(
      (sum, item) => sum + round2(toNumber(item.quantity) * toNumber(item.unitPrice)),
      0,
    ),
  );
  const discount = round2((subtotal * toNumber(input.discountPercent)) / 100);
  const netTotal = round2(subtotal - discount);
  const vat = input.vatApplied ? round2((netTotal * toNumber(input.vatRatePercent)) / 100) : 0;
  return { subtotal, discount, netTotal, vat, total: round2(netTotal + vat) };
}

export function lineTotal(quantity: string | number, unitPrice: string | number): number {
  return round2(toNumber(quantity) * toNumber(unitPrice));
}
