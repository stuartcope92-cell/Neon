"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers, quoteLineItems, quotes, type QuoteStatus } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { getQuote, logQuoteEvent } from "@/lib/quotes";
import { getSettings, reserveQuoteNumber } from "@/lib/settings";
import { STATUS_LABELS, type ActionState, type QuoteFormPayload } from "@/lib/types";
import { toNumber } from "@/lib/money";
import { addDaysISO } from "@/lib/dates";

function decimal(value: string | number, fallback = "0"): string {
  const n = toNumber(value);
  return Number.isFinite(n) ? n.toFixed(2) : fallback;
}

async function resolveCustomerId(payload: QuoteFormPayload): Promise<number> {
  if (payload.customerId) return payload.customerId;

  const draft = payload.newCustomer;
  if (!draft?.name.trim()) {
    throw new Error("Pick an existing customer or enter a name for a new one.");
  }
  const [created] = await db
    .insert(customers)
    .values({
      name: draft.name.trim(),
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      address: draft.address.trim() || null,
    })
    .returning({ id: customers.id });
  return created.id;
}

async function replaceLineItems(quoteId: number, items: QuoteFormPayload["lineItems"]) {
  await db.delete(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId));
  const rows = items
    .filter((item) => item.description.trim() || toNumber(item.quantity) !== 0)
    .map((item, index) => ({
      quoteId,
      type: item.type,
      description: item.description.trim(),
      quantity: decimal(item.quantity),
      unitPrice: decimal(item.unitPrice),
      sortOrder: index,
    }));
  if (rows.length) await db.insert(quoteLineItems).values(rows);
}

export async function saveQuoteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  let payload: QuoteFormPayload;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "")) as QuoteFormPayload;
  } catch {
    return { error: "Couldn't read the quote form. Please try again." };
  }

  // The clicked submit button decides draft vs sent.
  payload.markAsSent = formData.get("markAsSent") === "true";

  let quoteId = payload.quoteId;
  try {
    const customerId = await resolveCustomerId(payload);
    // Never take the client's word on VAT: if the business isn't VAT registered,
    // no quote it produces may include it, whatever the form posted.
    const settings = await getSettings();
    const vatApplied = settings.vatRegistered && payload.vatApplied;
    const shared = {
      customerId,
      signDescription: payload.signDescription.trim(),
      vatApplied,
      vatRatePercent: decimal(payload.vatRatePercent, "20"),
      discountPercent: decimal(payload.discountPercent),
      validUntil: payload.validUntil || null,
      internalNotes: payload.internalNotes.trim() || null,
      termsAndNotes: payload.termsAndNotes ?? "",
      updatedAt: new Date(),
    };

    if (quoteId) {
      const existing = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
      if (!existing[0]) return { error: "That quote no longer exists." };

      const nextStatus: QuoteStatus =
        payload.markAsSent && existing[0].status === "draft" ? "sent" : existing[0].status;

      await db.update(quotes).set({ ...shared, status: nextStatus }).where(eq(quotes.id, quoteId));
      await replaceLineItems(quoteId, payload.lineItems);
      if (nextStatus !== existing[0].status) {
        await logQuoteEvent(quoteId, `Marked as ${STATUS_LABELS[nextStatus].toLowerCase()}`);
      }
    } else {
      const quoteNumber = await reserveQuoteNumber();
      const [created] = await db
        .insert(quotes)
        .values({
          ...shared,
          quoteNumber,
          status: payload.markAsSent ? "sent" : "draft",
          validUntil: payload.validUntil || addDaysISO(30),
        })
        .returning({ id: quotes.id });
      quoteId = created.id;
      await replaceLineItems(quoteId, payload.lineItems);
      await logQuoteEvent(quoteId, "Quote created");
      if (payload.markAsSent) await logQuoteEvent(quoteId, "Marked as sent");
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't save the quote." };
  }

  revalidatePath("/");
  revalidatePath(`/quotes/${quoteId}`);
  redirect(`/quotes/${quoteId}`);
}

export async function setQuoteStatusAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = Number(formData.get("quoteId"));
  const status = String(formData.get("status")) as QuoteStatus;
  if (!id || !(status in STATUS_LABELS)) return;

  const [existing] = await db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
  if (!existing || existing.status === status) return;

  await db.update(quotes).set({ status, updatedAt: new Date() }).where(eq(quotes.id, id));
  await logQuoteEvent(id, `Marked as ${STATUS_LABELS[status].toLowerCase()}`);

  revalidatePath("/");
  revalidatePath(`/quotes/${id}`);
}

export async function duplicateQuoteAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = Number(formData.get("quoteId"));
  const source = await getQuote(id);
  if (!source) return;

  const quoteNumber = await reserveQuoteNumber();
  const [created] = await db
    .insert(quotes)
    .values({
      quoteNumber,
      customerId: source.customerId,
      signDescription: source.signDescription,
      status: "draft",
      vatApplied: source.vatApplied,
      vatRatePercent: source.vatRatePercent,
      discountPercent: source.discountPercent,
      validUntil: addDaysISO(30),
      internalNotes: source.internalNotes,
      termsAndNotes: source.termsAndNotes,
    })
    .returning({ id: quotes.id });

  if (source.lineItems.length) {
    await db.insert(quoteLineItems).values(
      source.lineItems.map((item, index) => ({
        quoteId: created.id,
        type: item.type,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        sortOrder: index,
      })),
    );
  }
  await logQuoteEvent(created.id, `Duplicated from ${source.quoteNumber}`);

  revalidatePath("/");
  redirect(`/quotes/${created.id}/edit`);
}

export async function deleteQuoteAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = Number(formData.get("quoteId"));
  if (!id) return;
  await db.delete(quotes).where(eq(quotes.id, id));
  revalidatePath("/");
  redirect("/");
}
