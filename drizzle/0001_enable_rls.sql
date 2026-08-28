-- Supabase exposes every table in the `public` schema through PostgREST using the
-- anon key, which is designed to be public. This app never uses that API — it talks
-- to Postgres directly as the `postgres` role, which has BYPASSRLS.
--
-- Enabling RLS with no policies therefore denies the anon/authenticated roles
-- everything while leaving the app completely unaffected.

ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "material_prices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quote_line_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "quote_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM anon, authenticated;
