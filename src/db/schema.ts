import {
  boolean,
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const quoteStatusEnum = pgEnum("quote_status", [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
]);

export const lineItemTypeEnum = pgEnum("line_item_type", ["labour", "material", "custom"]);

/**
 * Logins for the business. Everyone here shares the same quotes, customers,
 * prices and settings — this is one business with several people, not a
 * multi-tenant app. Signup is gated by SIGNUP_CODE.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  /** Always stored lowercase so logins are case-insensitive. */
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

/** Singleton row (id = 1) holding company branding and pricing defaults. */
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  companyName: text("company_name").notNull().default(""),
  logoUrl: text("logo_url"),
  addressLine1: text("address_line1"),
  addressLine2: text("address_line2"),
  city: text("city"),
  postcode: text("postcode"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull().default("0"),
  /**
   * Whether the business is VAT registered. Defaults to false: charging VAT you
   * aren't registered for is a legal problem, so VAT is opt-in rather than
   * something you have to remember to switch off.
   */
  vatRegistered: boolean("vat_registered").notNull().default(false),
  /** Default margins for new quotes. True margin (of the selling price), not markup. */
  profitMarginPercent: numeric("profit_margin_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  materialsMarginPercent: numeric("materials_margin_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  vatRatePercent: numeric("vat_rate_percent", { precision: 5, scale: 2 }).notNull().default("20"),
  defaultTermsAndNotes: text("default_terms_and_notes").notNull().default(""),
  quoteNumberPrefix: text("quote_number_prefix").notNull().default("NQ-"),
  nextQuoteNumber: integer("next_quote_number").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const materialPrices = pgTable("material_prices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  unit: text("unit").notNull().default("unit"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  address: text("address"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  quoteNumber: text("quote_number").notNull().unique(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  signDescription: text("sign_description").notNull().default(""),
  status: quoteStatusEnum("status").notNull().default("draft"),
  vatApplied: boolean("vat_applied").notNull().default(true),
  /** VAT rate captured at creation time so historical quotes stay accurate. */
  vatRatePercent: numeric("vat_rate_percent", { precision: 5, scale: 2 }).notNull().default("20"),
  discountPercent: numeric("discount_percent", { precision: 5, scale: 2 }).notNull().default("0"),
  /**
   * Margins captured per quote so re-pricing in Settings never rewrites a quote
   * already sent. Profit margin applies to labour and custom lines, materials
   * margin to material lines.
   */
  profitMarginPercent: numeric("profit_margin_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  materialsMarginPercent: numeric("materials_margin_percent", { precision: 5, scale: 2 })
    .notNull()
    .default("0"),
  validUntil: date("valid_until"),
  internalNotes: text("internal_notes"),
  /** Terms snapshot, so editing Settings doesn't rewrite quotes already sent. */
  termsAndNotes: text("terms_and_notes").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quoteLineItems = pgTable("quote_line_items", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  type: lineItemTypeEnum("type").notNull().default("custom"),
  description: text("description").notNull().default(""),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("0"),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
});

/** Append-only record of status transitions, powering the timeline on the detail page. */
export const quoteEvents = pgTable("quote_events", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id")
    .notNull()
    .references(() => quotes.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  customer: one(customers, { fields: [quotes.customerId], references: [customers.id] }),
  lineItems: many(quoteLineItems),
  events: many(quoteEvents),
}));

export const quoteLineItemsRelations = relations(quoteLineItems, ({ one }) => ({
  quote: one(quotes, { fields: [quoteLineItems.quoteId], references: [quotes.id] }),
}));

export const quoteEventsRelations = relations(quoteEvents, ({ one }) => ({
  quote: one(quotes, { fields: [quoteEvents.quoteId], references: [quotes.id] }),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  quotes: many(quotes),
}));

export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type MaterialPrice = typeof materialPrices.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
export type QuoteLineItem = typeof quoteLineItems.$inferSelect;
export type QuoteEvent = typeof quoteEvents.$inferSelect;
export type QuoteStatus = Quote["status"];
export type LineItemType = QuoteLineItem["type"];
