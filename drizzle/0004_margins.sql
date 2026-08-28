ALTER TABLE "quotes" ADD COLUMN "profit_margin_percent" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "materials_margin_percent" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "profit_margin_percent" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "materials_margin_percent" numeric(5, 2) DEFAULT '0' NOT NULL;