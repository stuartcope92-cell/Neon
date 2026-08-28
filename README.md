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

- **Connect → Connection string** — copy the **session pooler** string: port `5432` on
  `...pooler.supabase.com`. That is what the app runs on (`DATABASE_URL`) and it also runs
  migrations fine (`DIRECT_URL`).

  Do **not** use the transaction pooler (port `6543`) — see
  [Database access](#database-access) for why it deadlocks this driver. The plain direct
  connection (`db.<ref>.supabase.co:5432`) works from a dev machine but is IPv6-only, so it
  cannot be reached from Vercel.
- **Storage → New bucket** — only needed if you want to *change* the logo through the Settings page.
  Create a **public** bucket called `branding`. The current logo ships with the app, so this is
  optional (see [Company logo](#company-logo)).
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
| `DATABASE_URL` | Supabase **session pooler** (`...pooler.supabase.com:5432`) — used at runtime |
| `DIRECT_URL` | A port `5432` connection — used only for migrations |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL, for the logo upload |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only. Never goes near the browser |
| `SUPABASE_STORAGE_BUCKET` | Bucket name, defaults to `branding` |
| `SIGNUP_CODE` | Code required at `/signup` to create a login |
| `SESSION_SECRET` | 32+ random characters used to sign the session cookie |

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

#### 1. `DATABASE_URL` must be the session pooler

Use the **session pooler** string — port `5432` on `...pooler.supabase.com`. Two different failures
are waiting either side of it, and `npm run db:check` catches both:

- The **direct** connection (`db.<ref>.supabase.co:5432`) is IPv6-only and Vercel's functions are
  IPv4-only. The build goes green and every page behind the login 500s.
- The **transaction pooler** (`:6543`) connects fine and then deadlocks under any concurrency —
  see [Database access](#database-access).

#### 2. Use a different signup code and session secret

Set a `SIGNUP_CODE` for production that isn't the one in your local `.env.local`, and a different
`SESSION_SECRET`. Anyone with the code can create a login that sees all your quotes and customers.

```bash
node -e "console.log(require('crypto').randomBytes(12).toString('hex'))"
```

#### 3. Environment variables

**Settings → Environment Variables**, applied to Production (and Preview, if you want preview
deployments to work):

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Transaction pooler string, port `6543` |
| `SESSION_SECRET` | A fresh 32+ character random string |
| `SIGNUP_CODE` | The code people need in order to create a login |
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
    login/, signup/      The only unauthenticated routes
    (app)/               Everything behind auth: dashboard, quote builder, quote detail, settings
    api/quotes/[id]/pdf  Server-rendered PDF download
    actions/             Server actions (auth, quotes, settings)
  components/            Client UI: quote builder, filters, settings form, price list
  db/                    Drizzle schema + lazily-connected postgres.js client
  lib/                   Auth/session, storage, money + date helpers, quote and settings queries
  pdf/QuoteDocument.tsx  The branded PDF template
  middleware.ts          Redirects unauthenticated requests to /login
```

### Database access

The app talks to Postgres directly with Drizzle over `postgres.js` — it does not use the Supabase
client library for data.

`DATABASE_URL` must be Supabase's **session** pooler (port `5432`), not the transaction pooler
(`6543`). `postgres.js` pipelines queries onto each connection, and Supavisor's transaction mode
cannot split a pipelined connection across server connections — so as soon as two queries overlap,
the connection deadlocks and requests hang until they time out. Measured against this database:

| Pooler mode | 5 concurrent queries | 40 concurrent queries |
| --- | --- | --- |
| Transaction (`:6543`) | deadlocks | deadlocks |
| Session (`:5432`) | 530ms | 639ms |

A single page load issues several queries in parallel, so this is not an edge case — on the
transaction pooler, one in five requests completed. Session mode holds a server connection per
client connection, so the pool is kept small (`max: 5`) with a short idle timeout
([src/db/index.ts](src/db/index.ts)).

Because Supabase publishes the `public` schema through PostgREST using the (deliberately public)
anon key, [drizzle/0001_enable_rls.sql](drizzle/0001_enable_rls.sql) enables row-level security on
every table and revokes the anon/authenticated grants. No policies exist, so that API can't touch
the data. The app connects as `postgres`, which bypasses RLS, so it is unaffected.

### Auth

Accounts live in the `users` table. Anyone with the `SIGNUP_CODE` can create a login at `/signup`,
and **every login shares the same data** — the same quotes, customers, material prices and
settings. This is several people in one business, not a multi-tenant app: there is no per-account
isolation, so only hand the code to people you'd trust with the whole customer list. Change
`SIGNUP_CODE` to stop new signups; existing logins keep working.

Passwords are hashed with scrypt (`scrypt:<salt>:<hash>`, colon-separated because Next's dotenv
would try to expand a `$`-delimited value) and never stored in any other form. Logging in with an
unknown email still runs a hash comparison, so it takes about as long as a wrong password and
doesn't reveal which emails exist.

Sessions are a signed JWT in an httpOnly cookie, good for 7 days.
[src/middleware.ts](src/middleware.ts) bounces unauthenticated requests to `/login` (and sends
signed-in users away from `/login` and `/signup`), and every server component, server action and
the PDF route independently calls `requireSession()` / `getSession()` — the middleware is a
convenience, never the only check.

Two things this deliberately does not have, being a small internal tool: **password reset** (locked
out means signing up again with the code) and **session revocation** (deleting a user doesn't kill
a session they already hold until it expires). Both are easy to add if you want them.

### Company logo

The logo lives in two places: `public/logo.png` for the browser, and
[src/pdf/logo.ts](src/pdf/logo.ts) as a base64 data URI for the PDF. The duplication is
deliberate — the PDF renders inside a serverless function, where files under `public/` are not
reliably readable from disk, so a PDF that loads the logo off the filesystem works locally and
breaks in production.

To change the logo:

```bash
node scripts/bundle-logo.mjs
```

Replace `public/logo.png` first; the script regenerates the bundled copy. Alternatively, upload one
through Settings (needs Supabase Storage configured) — an uploaded `logoUrl` starting with `http`
takes precedence over the bundled file.

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

## Not in v1

Emailing PDFs from the app, multi-user accounts, e-signature/online acceptance, multiple currencies
or tax regimes, recurring pricing — all out of scope per the spec.
