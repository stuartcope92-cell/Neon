/** Shapes shared between the client builder UI and the server actions. */
import type { LineItemType, QuoteStatus } from "@/db/schema";

export type LineItemDraft = {
  key: string;
  type: LineItemType;
  description: string;
  quantity: string;
  unitPrice: string;
};

export type QuoteFormPayload = {
  quoteId?: number;
  customerId: number | null;
  newCustomer: { name: string; email: string; phone: string; address: string } | null;
  signDescription: string;
  discountPercent: string;
  vatApplied: boolean;
  vatRatePercent: string;
  validUntil: string | null;
  internalNotes: string;
  termsAndNotes: string;
  lineItems: LineItemDraft[];
  markAsSent: boolean;
};

export type ActionState = { error?: string; ok?: boolean };

export const STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};
