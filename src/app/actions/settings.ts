"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { materialPrices } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { updateSettings } from "@/lib/settings";
import { storageConfigured, uploadLogo } from "@/lib/storage";
import { clampMargin, toNumber } from "@/lib/money";
import type { ActionState } from "@/lib/types";

function text(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function decimal(formData: FormData, key: string, fallback: string): string {
  const raw = formData.get(key);
  if (raw === null || String(raw).trim() === "") return fallback;
  return toNumber(String(raw)).toFixed(2);
}

export async function saveSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const vatRate = toNumber(String(formData.get("vatRatePercent") ?? "20"));
  if (vatRate < 0 || vatRate > 100) return { error: "VAT rate must be between 0 and 100." };

  let logoUrl: string | null | undefined = undefined;
  const logo = formData.get("logo");
  if (formData.get("removeLogo") === "on") {
    logoUrl = null;
  } else if (logo instanceof File && logo.size > 0) {
    if (!logo.type.startsWith("image/")) return { error: "The logo must be an image file." };
    if (logo.size > 4 * 1024 * 1024) return { error: "The logo must be smaller than 4MB." };
    if (!storageConfigured()) {
      return {
        error:
          "Logo upload needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.",
      };
    }
    try {
      logoUrl = await uploadLogo(logo);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Logo upload failed." };
    }
  }

  try {
    await updateSettings({
      companyName: String(formData.get("companyName") ?? "").trim(),
      ...(logoUrl !== undefined ? { logoUrl } : {}),
      addressLine1: text(formData, "addressLine1"),
      addressLine2: text(formData, "addressLine2"),
      city: text(formData, "city"),
      postcode: text(formData, "postcode"),
      phone: text(formData, "phone"),
      email: text(formData, "email"),
      website: text(formData, "website"),
      hourlyRate: decimal(formData, "hourlyRate", "0"),
      vatRegistered: formData.get("vatRegistered") === "on",
      profitMarginPercent: clampMargin(String(formData.get("profitMarginPercent") ?? "0")).toFixed(2),
      materialsMarginPercent: clampMargin(
        String(formData.get("materialsMarginPercent") ?? "0"),
      ).toFixed(2),
      vatRatePercent: decimal(formData, "vatRatePercent", "20"),
      defaultTermsAndNotes: String(formData.get("defaultTermsAndNotes") ?? ""),
      quoteNumberPrefix: String(formData.get("quoteNumberPrefix") ?? "").trim(),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't save settings." };
  }

  revalidatePath("/settings");
  return { ok: true };
}

export async function saveMaterialPriceAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = Number(formData.get("id") ?? 0);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const values = {
    name,
    unit: String(formData.get("unit") ?? "unit").trim() || "unit",
    unitPrice: toNumber(String(formData.get("unitPrice") ?? "0")).toFixed(2),
  };

  if (id) {
    await db.update(materialPrices).set(values).where(eq(materialPrices.id, id));
  } else {
    await db.insert(materialPrices).values(values);
  }
  revalidatePath("/settings");
}

/**
 * Soft-delete only: historical quotes keep their own copy of the description and
 * price, but retiring an entry must never break them.
 */
export async function toggleMaterialPriceAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = Number(formData.get("id") ?? 0);
  if (!id) return;
  const active = formData.get("active") === "true";
  await db.update(materialPrices).set({ active }).where(eq(materialPrices.id, id));
  revalidatePath("/settings");
}
