# Neon Sign Quote Creator

A single-admin web app for building customer quotes for custom neon signs, downloading them as
branded PDFs, and tracking their status. Built to the brief in
[neon-quote-app-spec.md](neon-quote-app-spec.md).

- **Stack:** Next.js (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM
- **Deploys as:** GitHub repo → Vercel (hosting) → Supabase (Postgres + Storage)
- **Currency:** GBP, VAT configurable (default 20%, can be switched off per quote)

## Setup

### 1. Supabase

Create a project at [supabase.com](https://supabase.com), then:

- **Connect → Connection string** — copy both the *transaction pooler* string (port `6543`) and a
  port `5432` string. The app runs on the pooler; migrations need the `5432` connection.

  If the *direct* connection (`db.<ref>.supabase.co:5432`) times out, use the **session pooler**
  string instead — same port `5432`, but on `...pooler.supabase.com`. Direct connections are
  IPv6-only on new Supabase projects, so they fail on IPv4-only networks. The session pooler is the
  IPv4-friendly equivalent and runs migrations fine.
- **Storage → New bucket** — create a **public** bucket called `branding` (this is where the company
  logo lives). Skip this if you don't need a logo on your PDFs.
- **Project Settings → API** — copy the project URL and the `service_role` key.

### 2. Local environment

```bash
npm install
```

```bash
cp .env.example .env.local
```

| Variable | What it's for |
| --- | --- |
| `DATABASE_URL` | Supabase transaction pooler (`:6543`) — used at runtime |
| `DIRECT_URL` | Supabase direct connection (`:5432`) — used only for migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, for the logo upload |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only. Never goes near the browser |
| `SUPABASE_STORAGE_BUCKET` | Bucket name, defaults to `branding` |
| `ADMIN_EMAIL` | The one admin login |
| `ADMIN_PASSWORD_HASH` | scrypt hash of the admin password |
| `SESSION_SECRET` | 32+ random characters used to sign the session cookie |

Generate the password hash and a session secret:

```bash
npm run hash-password -- "your-password"
```

### 3. Set the database password

Paste both connection strings into `.env.local` leaving `[YOUR-PASSWORD]` in place, then:

```bash
npm run db:password
```

It prompts with the input hidden, URL-encodes whatever you type (so `@ : / ? #` in a password
can't break the connection string) and substitutes it into both URLs. The password never appears
on screen or in your shell history.

### 4. Check the link, create the tables, run it

Confirm both connection strings and the storage bucket are wired up correctly:

```bash
npm run db:check
```

It reports each item separately and tells you how to fix whatever is wrong (placeholder password
left in, pooler and direct strings swapped, bucket missing or private, migrations not applied).

```bash
npm run db:migrate
```

```bash
npm run dev
```

Sign in at `/login`, then go to **Settings** and set your company details, hourly rate, VAT rate and
material price list before creating your first quote. The database ships empty — there is no seed
data.

### 5. GitHub → Vercel

Push the repo:

```bash
git remote add origin <your-repo-url> && git push -u origin main
```

Import it at [vercel.com/new](https://vercel.com/new). The Next.js preset is detected
automatically — build command, output directory and install command all stay on their defaults.
Then work through the four points below before you trust the first deploy.

#### 1. `DATABASE_URL` must be the pooler

This is the one that silently breaks. Use the **transaction pooler** string (port `6543`,
`...pooler.supabase.com`) from Supabase → Connect.

The direct connection (`db.<ref>.supabase.co:5432`) works from a developer machine but is
**IPv6-only**, and Vercel's functions are IPv4-only. The build will go green and every page behind
the login will 500. `npm run db:check` warns when `DATABASE_URL` points at the direct host.

#### 2. Set a real admin password

The credentials in your local `.env.local` are for development. Generate a fresh hash for
production so the deployed app doesn't share a password with your laptop:

```bash
npm run hash-password -- "a-strong-production-password"
```

Use a different `SESSION_SECRET` in production too.

#### 3. Environment variables

**Settings → Environment Variables**, applied to Production (and Preview, if you want preview
deployments to work):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Transaction pooler string, port `6543` |
| `SESSION_SECRET` | A fresh 32+ character random string |
| `ADMIN_EMAIL` | Your real admin email |
| `ADMIN_PASSWORD_HASH` | The production hash from step 2 |
| `NEXT_PUBLIC_SUPABASE_URL` | Only if you want logo upload |
| `SUPABASE_SERVICE_ROLE_KEY` | Only if you want logo upload |
| `SUPABASE_STORAGE_BUCKET` | Only if your bucket isn't named `branding` |

`DIRECT_URL` is **not** needed on Vercel — migrations only ever run from your machine.

Vercel doesn't rebuild when you change an environment variable, so redeploy afterwards.

#### 4. Migrations

The deploy does not run them. Apply the schema from your machine, pointed at the same database:

```bash
npm run db:migrate
```

Preview deployments share the production database unless you create a second Supabase project for
them. For a single-user tool that's usually fine, but it does mean a preview deploy writes real
quotes.

Pushes to `main` deploy automatically. [.github/workflows/ci.yml](.github/workflows/ci.yml) runs
the typecheck and build on every PR.

#### Optional: put the functions near the database

Every page does a database round trip, so the default US function region adds latency if your
Supabase project is in Europe. Set **Settings → Functions → Function Region** to the region
matching your Supabase project (for a London project, `lhr1`).

## How it fits together

```
src/
  app/
    login/               Login page (the only unauthenticated route)
    (app)/               Everything behind auth: dashboard, quote builder, quote detail, settings
    api/quotes/[id]/pdf  Server-rendered PDF download
    actions/             Server actions (auth, quotes, settings)
  components/            Client UI: quote builder, filters, settings form, price list
  db/                    Drizzle schema + lazily-connected postgres.js client
  lib/                   Auth/session, storage, money + date helpers, quote and settings queries
  pdf/QuoteDocument.tsx  The branded PDF template
middleware.ts            Redirects unauthenticated requests to /login
```

### Database access

The app talks to Postgres directly with Drizzle over `postgres.js` — it does not use the Supabase
client library for data. On the pooler, prepared statements are off and connections are capped at
one per invocation ([src/db/index.ts](src/db/index.ts)), which is what Supavisor's transaction mode
expects from serverless functions.

Because Supabase publishes the `public` schema through PostgREST using the (deliberately public)
anon key, [drizzle/0001_enable_rls.sql](drizzle/0001_enable_rls.sql) enables row-level security on
every table and revokes the anon/authenticated grants. No policies exist, so that API can't touch
the data. The app connects as `postgres`, which bypasses RLS, so it is unaffected.

### Auth

One admin account, credentials in environment variables — no signup flow, nothing hardcoded. This
app does **not** use Supabase Auth: for a single-user tool it would be a second identity system to
manage for no gain. Passwords are stored as `scrypt:<salt>:<hash>` (colon-separated, because Next's
dotenv would try to expand a `$`-delimited value). `middleware.ts` bounces unauthenticated requests,
and every server component, server action and the PDF route independently calls `requireSession()` /
`getSession()` — the UI check is never the only check.

### Pricing

Totals are derived, never stored:

```
subtotal = Σ(quantity × unit price)
discount = subtotal × discount%
vat      = (subtotal − discount) × vat%   (if VAT is applied)
total    = subtotal − discount + vat
```

Each step is rounded to whole pence ([src/lib/money.ts](src/lib/money.ts)). Quotes snapshot their
VAT rate and terms text at creation time, so editing Settings never rewrites a quote that has
already gone out. Material prices are retired (soft-deleted), never hard-deleted, and line items
keep their own copy of the description and price.

### Quote numbering

`Settings.nextQuoteNumber` is incremented with a single atomic `UPDATE … RETURNING`, so two quotes
created at the same moment can't collide. Numbers are formatted as `{prefix}{0000}`, e.g. `NQ-0001`.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:password` | Write your database password into `.env.local`, hidden input |
| `npm run db:check` | Verify the Supabase connection, schema, RLS and storage bucket |
| `npm run db:generate` | Regenerate SQL migrations from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations in `drizzle/` (uses `DIRECT_URL`) |
| `npm run hash-password -- "pw"` | Print an `ADMIN_PASSWORD_HASH` (and a spare `SESSION_SECRET`) |

## Not in v1

Emailing PDFs from the app, multi-user accounts, e-signature/online acceptance, multiple currencies
or tax regimes, recurring pricing — all out of scope per the spec.
