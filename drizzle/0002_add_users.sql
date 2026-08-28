CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
-- Same reasoning as 0001: keep the table off Supabase's public PostgREST API.
-- Password hashes must never be reachable with the anon key.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "users" FROM anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON SEQUENCE "users_id_seq" FROM anon, authenticated;
