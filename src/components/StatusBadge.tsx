import type { QuoteStatus } from "@/db/schema";
import { STATUS_LABELS } from "@/lib/types";

const STYLES: Record<QuoteStatus, string> = {
  draft: "border-line bg-surface-2 text-muted",
  sent: "border-accent/40 bg-accent/10 text-accent",
  accepted: "border-positive/40 bg-positive/10 text-positive",
  declined: "border-danger/40 bg-danger/10 text-danger",
  expired: "border-warning/40 bg-warning/10 text-warning",
};

export default function StatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
