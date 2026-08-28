import React from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { getSession } from "@/lib/auth";
import { getQuote, totalsFor } from "@/lib/quotes";
import { getSettings } from "@/lib/settings";
import QuoteDocument, { type QuotePdfData } from "@/pdf/QuoteDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Strips characters that browsers/filesystems dislike in a download filename. */
function safeFilePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9 _-]/g, "").trim().replace(/\s+/g, "-") || "customer";
}

/** Inlines the logo as a data URI so react-pdf never has to fetch it itself. */
async function loadLogo(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "image/png";
    if (contentType.includes("svg")) return null; // react-pdf can't rasterise SVG sources
    const base64 = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  // API routes check the session themselves, not just the UI.
  const session = await getSession();
  if (!session) return new Response("Unauthorised", { status: 401 });

  const { id } = await context.params;
  const quoteId = Number(id);
  if (!Number.isInteger(quoteId)) return new Response("Not found", { status: 404 });

  const [quote, settings] = await Promise.all([getQuote(quoteId), getSettings()]);
  if (!quote) return new Response("Not found", { status: 404 });

  const data: QuotePdfData = {
    quoteNumber: quote.quoteNumber,
    createdAt: quote.createdAt,
    validUntil: quote.validUntil,
    signDescription: quote.signDescription,
    discountPercent: quote.discountPercent,
    vatApplied: quote.vatApplied,
    vatRatePercent: quote.vatRatePercent,
    termsAndNotes: quote.termsAndNotes,
    customer: {
      name: quote.customer.name,
      email: quote.customer.email,
      phone: quote.customer.phone,
      address: quote.customer.address,
    },
    lineItems: quote.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    totals: totalsFor(quote),
    company: {
      name: settings.companyName,
      logo: await loadLogo(settings.logoUrl),
      addressLines: [
        settings.addressLine1,
        settings.addressLine2,
        [settings.city, settings.postcode].filter(Boolean).join(" "),
      ].filter((line): line is string => Boolean(line && line.trim())),
      contactLines: [settings.phone, settings.email, settings.website].filter(
        (line): line is string => Boolean(line && line.trim()),
      ),
    },
  };

  // react-pdf types the root as a <Document>; our wrapper renders exactly that.
  const element = React.createElement(QuoteDocument, { data }) as React.ReactElement<DocumentProps>;
  const buffer = await renderToBuffer(element);
  const filename = `Quote-${safeFilePart(quote.quoteNumber)}-${safeFilePart(quote.customer.name)}.pdf`;

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
