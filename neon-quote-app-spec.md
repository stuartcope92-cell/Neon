# Neon Sign Quote Creator — Build Spec

A web app for a neon sign company to build customer quotes, download them as branded PDFs, and track their status over time. This document is written to be handed directly to Claude Code as the implementation brief.

## 1. Goal

Replace ad-hoc quoting with a single tool that:

- Lets the business owner create a quote for a custom neon sign in a few minutes.
- Calculates pricing automatically from configurable rates (labour + materials) rather than manual arithmetic.
- Produces a clean, branded PDF the customer can be sent.
- Keeps a searchable record of every quote and its status (draft, sent, accepted, declined, expired).
- Works well on a desktop (primary use case — building quotes at a desk) and remains fully usable on a phone or tablet (checking status, viewing a quote on the move).

## 2. Tech Stack

- **Framework:** Next.js (App Router), TypeScript, React.
- **Styling:** Tailwind CSS. Desktop-first layouts (wide tables, side-by-side forms) that collapse gracefully to single-column on mobile.
- **Hosting:** Vercel.
- **Database:** Vercel Postgres (Neon under the hood). Use Drizzle ORM or Prisma — either is fine, pick one and be consistent.
- **Auth:** Single admin login (this is a one-person/one-business tool, not multi-tenant). Simple credentials-based auth (NextAuth.js with a Credentials provider, or a lightweight custom session using a hashed password + signed cookie) protecting every route except the login page. The password hash and session secret live in environment variables / the database, never hardcoded.
- **PDF generation:** `@react-pdf/renderer` (renders PDFs from React components server-side — good fit for a branded, templated document) or `pdf-lib` if more manual control is preferred. Generate on the server (API route / server action) and stream the file back for download.
- **File storage (logo upload):** Vercel Blob for storing the uploaded company logo image.
- **Currency/tax:** GBP (£). VAT is a configurable percentage in Settings, defaulting to 20%, applied as a line on the quote total. Support turning VAT off per-quote if the business ever needs a zero-VAT quote.

## 3. Data Model

```
Settings (singleton row)
- id
- companyName
- logoUrl
- addressLine1, addressLine2, city, postcode
- phone, email, website
- hourlyRate (decimal, £/hour — default labour rate)
- vatRatePercent (decimal, default 20)
- defaultTermsAndNotes (text — appears at the bottom of every PDF, editable)
- quoteNumberPrefix (text, e.g. "NQ-", optional)
- nextQuoteNumber (integer, auto-increments per quote created)

MaterialPrice
- id
- name (e.g. "LED neon flex — per metre", "Acrylic backing — per sheet", "Power supply unit")
- unit (e.g. "metre", "sheet", "unit", "hour")
- unitPrice (decimal, £)
- active (boolean — soft-delete so historical quotes aren't affected if a price is retired)

Customer
- id
- name
- email
- phone
- address (optional)
- createdAt

Quote
- id
- quoteNumber (e.g. "NQ-0001", generated from Settings.nextQuoteNumber)
- customerId (FK)
- signDescription (text — free text describing the sign, e.g. "Custom 'Open' script sign, 60cm wide, pink")
- status (enum: draft | sent | accepted | declined | expired)
- vatApplied (boolean, defaults to Settings default)
- discountPercent (decimal, optional, default 0)
- validUntil (date, optional — quotes typically expire after 30 days)
- internalNotes (text, optional — not shown on the PDF)
- createdAt, updatedAt

QuoteLineItem
- id
- quoteId (FK)
- type (enum: labour | material | custom)
- description (text — pre-filled from MaterialPrice name if selected, editable)
- quantity (decimal — hours for labour, units for material)
- unitPrice (decimal — pre-filled from Settings.hourlyRate or MaterialPrice.unitPrice, editable per line)
- lineTotal (computed: quantity × unitPrice)
- sortOrder (integer, for drag-reordering on the quote)
```

Quote totals are derived, not stored redundantly where avoidable:
`subtotal = sum(lineTotal)` → `discount = subtotal × discountPercent` → `vat = (subtotal - discount) × vatRatePercent` (if applied) → `total = subtotal - discount + vat`.

## 4. Pages / Routes

### `/login`
Simple email+password (or username+password) form. No self-signup — the one admin account is seeded via a script or env var on first deploy.

### `/` — Dashboard
- List of recent quotes (table on desktop, stacked cards on mobile) showing: quote number, customer name, sign description (truncated), total, status badge, date created.
- Search/filter by customer name, status, and date range.
- Sort by newest, oldest, highest value.
- "New Quote" button prominent at the top.
- Quick stats row (optional but nice): total quotes this month, total value of accepted quotes, number of quotes awaiting response.

### `/quotes/new` and `/quotes/[id]/edit` — Quote Builder
- Customer section: pick an existing customer (searchable dropdown) or create a new one inline.
- Sign description field (free text).
- Line items table:
  - "Add labour" button → inserts a row pre-filled with the default hourly rate from Settings; quantity = hours.
  - "Add material" button → opens a picker of active MaterialPrice entries; selecting one inserts a row pre-filled with its unit price; quantity = number of units.
  - "Add custom line" button → blank row for anything not covered by the price list.
  - Every field (description, quantity, unit price) stays editable after insertion, so one-off adjustments don't require touching Settings.
  - Rows can be reordered and deleted.
- Discount % field.
- VAT toggle (defaults from Settings).
- Valid-until date picker (default: today + 30 days).
- Live-updating totals panel: subtotal, discount, VAT, grand total — recalculates as line items change, no page reload.
- Internal notes field (never printed on the customer-facing PDF).
- Save as Draft / Save and mark as Sent.

### `/quotes/[id]` — Quote Detail
- Read-only view of the quote as the customer would see it, plus:
  - Status changer (draft → sent → accepted/declined/expired).
  - "Download PDF" button.
  - "Edit" button (back to the builder).
  - "Duplicate" button (handy for near-identical repeat orders — copies line items into a new draft).
  - Timeline of status changes (created, sent, responded) if easy to add; otherwise just createdAt/updatedAt is fine for v1.

### `/settings`
- Company details form: name, logo upload, address, phone, email, website.
- Default hourly rate.
- VAT rate.
- Material price list: table of MaterialPrice entries with add/edit/deactivate (not hard-delete, to preserve historical quote accuracy).
- Default terms & notes text (free text / rich text, printed on every PDF footer).
- Quote number prefix.
- Save button; changes apply to new quotes going forward, not retroactively to existing ones.

## 5. PDF Quote

Generated server-side from the Quote + its line items + Settings (for branding). Should include:

- Company logo, name, address, contact details (header).
- Quote number, date issued, valid-until date.
- Customer name and contact details.
- Sign description.
- Line items table (description, quantity, unit price, line total).
- Subtotal, discount (if any), VAT (if applied), grand total — clearly laid out.
- Terms & notes footer from Settings.
- Clean, single-page-if-possible layout suitable for emailing or printing. No internal notes.

Filename on download: `Quote-{quoteNumber}-{customerName}.pdf`.

## 6. Non-functional requirements

- **Responsive:** desktop is the primary design target (the quote builder benefits from a wide layout with the line-item table and totals panel side by side), but every page must remain fully usable on a phone — single-column stacking, tap-friendly controls, no horizontal scrolling required for core actions.
- **Auth-gated:** every route except `/login` requires a valid session; API routes/server actions check the session too, not just the UI.
- **Data integrity:** deleting a MaterialPrice should deactivate rather than hard-delete it, so historical quotes referencing it still render correctly.
- **No dummy data in production:** ship with an empty database; the admin adds their own material prices via Settings on first use.

## 7. Suggested build order

1. Scaffold Next.js + Tailwind + Vercel Postgres connection + ORM schema/migrations for the data model above.
2. Auth: login page + session protection on all routes.
3. Settings page (company details, hourly rate, VAT rate, material price list) — needed before quotes can be priced meaningfully.
4. Quote builder (create/edit) with live totals.
5. Dashboard (list, search, filter, status).
6. Quote detail page + status changes + duplicate.
7. PDF generation and download.
8. Polish responsive behaviour on mobile, test end-to-end (create quote → download PDF → change status → find it via search).
9. Deploy to Vercel; document required environment variables (database connection string, session secret, admin credentials, Blob storage token) in a README.

## 8. Out of scope for v1 (possible future additions)

- Emailing the PDF directly to the customer from the app.
- Multi-user accounts / roles.
- E-signature / online quote acceptance.
- Multiple currencies or tax regimes.
- Recurring/subscription pricing for maintenance contracts.
