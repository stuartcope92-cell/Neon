/** Money helpers. Everything is GBP and rounded to whole pence at each step. */

import type { LineItemType } from "@/db/schema";

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

/** A margin of 100% would divide by zero; nothing sensible is above this. */
export const MAX_MARGIN_PERCENT = 99;

export function clampMargin(value: string | number): number {
  const n = toNumber(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_MARGIN_PERCENT);
}

/**
 * True margin, not markup: the percentage is of the *selling* price, so a 20%
 * margin on £100 of cost gives a £125 price of which £25 (20%) is profit.
 */
export function applyMargin(cost: string | number, marginPercent: string | number): number {
  const c = toNumber(cost);
  const m = clampMargin(marginPercent);
  if (m === 0) return round2(c);
  return round2(c / (1 - m / 100));
}

export type MarginRates = {
  /** Applied to labour and custom lines. */
  profitMarginPercent: string | number;
  /** Applied to material lines. */
  materialsMarginPercent: string | number;
};

export type PricedLine = {
  type?: LineItemType;
  quantity: string | number;
  unitPrice: string | number;
};

/** Which margin a line attracts: materials get theirs, everything else the profit margin. */
export function marginFor(type: LineItemType | undefined, margins: MarginRates): number {
  return clampMargin(type === "material" ? margins.materialsMarginPercent : margins.profitMarginPercent);
}

/**
 * The unit price the customer sees — cost plus margin, rounded to pence, so that
 * quantity × unit price always equals the line total printed beside it.
 */
export function sellUnitPrice(line: PricedLine, margins: MarginRates): number {
  return applyMargin(line.unitPrice, marginFor(line.type, margins));
}

export function lineSellTotal(line: PricedLine, margins: MarginRates): number {
  return round2(toNumber(line.quantity) * sellUnitPrice(line, margins));
}

/** Cost before margin — internal only, never shown to a customer. */
export function lineCostTotal(line: PricedLine): number {
  return round2(toNumber(line.quantity) * toNumber(line.unitPrice));
}

export type TotalsInput = {
  lineItems: PricedLine[];
  margins: MarginRates;
  discountPercent: string | number;
  vatApplied: boolean;
  vatRatePercent: string | number;
};

export type Totals = {
  /** Sum of quantity × cost. Internal. */
  costSubtotal: number;
  /** What the margins added. Internal. */
  marginAmount: number;
  subtotal: number;
  discount: number;
  netTotal: number;
  vat: number;
  total: number;
};

export function calculateTotals(input: TotalsInput): Totals {
  const costSubtotal = round2(
    input.lineItems.reduce((sum, item) => sum + lineCostTotal(item), 0),
  );
  const subtotal = round2(
    input.lineItems.reduce((sum, item) => sum + lineSellTotal(item, input.margins), 0),
  );
  const discount = round2((subtotal * toNumber(input.discountPercent)) / 100);
  const netTotal = round2(subtotal - discount);
  const vat = input.vatApplied ? round2((netTotal * toNumber(input.vatRatePercent)) / 100) : 0;

  return {
    costSubtotal,
    marginAmount: round2(subtotal - costSubtotal),
    subtotal,
    discount,
    netTotal,
    vat,
    total: round2(netTotal + vat),
  };
}

/** Line total at a given price, with no margin involved. */
export function lineTotal(quantity: string | number, unitPrice: string | number): number {
  return round2(toNumber(quantity) * toNumber(unitPrice));
}
