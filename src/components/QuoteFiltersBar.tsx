"use client";

import { useRef } from "react";
import Link from "next/link";
import { STATUS_LABELS } from "@/lib/types";

type Defaults = { q: string; status: string; from: string; to: string; sort: string };

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "value", label: "Highest value" },
];

export default function QuoteFiltersBar({ defaults }: { defaults: Defaults }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();

  const hasFilters =
    defaults.q || defaults.from || defaults.to || defaults.status !== "all" || defaults.sort !== "newest";

  return (
    <form ref={formRef} action="/" method="get" className="card grid gap-3 p-4 md:grid-cols-12">
      <div className="md:col-span-4">
        <label className="label" htmlFor="q">
          Search
        </label>
        <input
          id="q"
          name="q"
          defaultValue={defaults.q}
          className="field"
          placeholder="Customer, quote number or sign…"
        />
      </div>

      <div className="md:col-span-2">
        <label className="label" htmlFor="status">
          Status
        </label>
        <select id="status" name="status" defaultValue={defaults.status} className="field" onChange={submit}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label className="label" htmlFor="from">
          From
        </label>
        <input id="from" name="from" type="date" defaultValue={defaults.from} className="field" onChange={submit} />
      </div>

      <div className="md:col-span-2">
        <label className="label" htmlFor="to">
          To
        </label>
        <input id="to" name="to" type="date" defaultValue={defaults.to} className="field" onChange={submit} />
      </div>

      <div className="md:col-span-2">
        <label className="label" htmlFor="sort">
          Sort
        </label>
        <select id="sort" name="sort" defaultValue={defaults.sort} className="field" onChange={submit}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2 md:col-span-12">
        <button type="submit" className="btn">
          Apply
        </button>
        {hasFilters ? (
          <Link href="/" className="btn btn-ghost">
            Clear
          </Link>
        ) : null}
      </div>
    </form>
  );
}
