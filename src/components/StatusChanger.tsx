"use client";

import { useRef } from "react";
import { setQuoteStatusAction } from "@/app/actions/quotes";
import { STATUS_LABELS } from "@/lib/types";
import type { QuoteStatus } from "@/db/schema";

export default function StatusChanger({
  quoteId,
  status,
}: {
  quoteId: number;
  status: QuoteStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={setQuoteStatusAction} className="space-y-3">
      <input type="hidden" name="quoteId" value={quoteId} />
      <label className="label" htmlFor="status-select">
        Change status
      </label>
      <select
        id="status-select"
        name="status"
        className="field"
        defaultValue={status}
        onChange={() => formRef.current?.requestSubmit()}
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {/* Fallback for browsers without JS. */}
      <noscript>
        <button type="submit" className="btn w-full">
          Update status
        </button>
      </noscript>
    </form>
  );
}
