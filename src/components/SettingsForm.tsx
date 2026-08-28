"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { saveSettingsAction } from "@/app/actions/settings";
import { toNumber } from "@/lib/money";
import type { ActionState } from "@/lib/types";
import type { Settings } from "@/db/schema";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Saving..." : "Save settings"}
    </button>
  );
}

export default function SettingsForm({ settings }: { settings: Settings }) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSettingsAction, {});

  return (
    <form action={formAction} className="space-y-6">
      <section className="card p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">
          Company details
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" name="companyName" defaultValue={settings.companyName} />
          <Field label="Website" name="website" defaultValue={settings.website ?? ""} />
          <Field label="Address line 1" name="addressLine1" defaultValue={settings.addressLine1 ?? ""} />
          <Field label="Address line 2" name="addressLine2" defaultValue={settings.addressLine2 ?? ""} />
          <Field label="City" name="city" defaultValue={settings.city ?? ""} />
          <Field label="Postcode" name="postcode" defaultValue={settings.postcode ?? ""} />
          <Field label="Phone" name="phone" defaultValue={settings.phone ?? ""} />
          <Field label="Email" name="email" type="email" defaultValue={settings.email ?? ""} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="logo">
              Company logo
            </label>
            <input
              id="logo"
              name="logo"
              type="file"
              accept="image/*"
              className="field file:mr-3 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-xs file:text-body"
            />
            <p className="mt-1 text-xs text-muted">PNG or SVG, up to 4MB. Printed on every PDF.</p>
          </div>
          <div className="flex items-end gap-4">
            {settings.logoUrl ? (
              <>
                <Image
                  src={settings.logoUrl}
                  alt="Current logo"
                  width={120}
                  height={60}
                  className="h-14 w-auto rounded border border-line-soft bg-white/5 object-contain p-1"
                  unoptimized
                />
                <label className="flex items-center gap-2 text-sm text-muted">
                  <input type="checkbox" name="removeLogo" className="h-4 w-4" />
                  Remove logo
                </label>
              </>
            ) : (
              <p className="text-sm text-muted">No logo uploaded yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-white">
          Pricing defaults
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Hourly labour rate (£)"
            name="hourlyRate"
            inputMode="decimal"
            defaultValue={String(toNumber(settings.hourlyRate))}
          />
          <Field
            label="VAT rate (%)"
            name="vatRatePercent"
            inputMode="decimal"
            defaultValue={String(toNumber(settings.vatRatePercent))}
          />
          <Field
            label="Quote number prefix"
            name="quoteNumberPrefix"
            defaultValue={settings.quoteNumberPrefix}
          />
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-lg border border-line-soft p-3 text-sm">
          <input
            type="checkbox"
            name="vatRegistered"
            defaultChecked={settings.vatRegistered}
            className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]"
          />
          <span>
            <span className="font-semibold text-white">The business is VAT registered</span>
            <span className="mt-0.5 block text-xs text-muted">
              Leave this off if you aren&rsquo;t registered. Quotes then carry no VAT at all &mdash;
              no VAT line, no VAT in the total &mdash; and the rate above is ignored. Quotes you have
              already sent keep whatever they were built with.
            </span>
          </span>
        </label>
        <p className="mt-2 text-xs text-muted">
          Next quote will be numbered{" "}
          <span className="font-mono text-body">
            {settings.quoteNumberPrefix}
            {String(settings.nextQuoteNumber).padStart(4, "0")}
          </span>
          .
        </p>
      </section>

      <section className="card p-4 sm:p-5">
        <label className="label" htmlFor="defaultTermsAndNotes">
          Default terms &amp; notes (printed at the foot of every PDF)
        </label>
        <textarea
          id="defaultTermsAndNotes"
          name="defaultTermsAndNotes"
          className="field min-h-32"
          defaultValue={settings.defaultTermsAndNotes}
          placeholder={
            "50% deposit due on acceptance, balance on completion.\nLead time 3–4 weeks from deposit.\nAll signs carry a 12-month warranty."
          }
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <SaveButton />
        {state.error ? (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        ) : null}
        {state.ok ? <p className="text-sm text-positive">Settings saved.</p> : null}
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  inputMode,
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  inputMode?: "decimal" | "text";
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        inputMode={inputMode}
        className="field"
        defaultValue={defaultValue}
      />
    </div>
  );
}
