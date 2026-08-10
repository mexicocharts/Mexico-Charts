import { boolean, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const userAccounts = pgTable("user_accounts", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  email: text("email"),
  displayName: text("display_name"),
  plan: text("plan").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const savedArtists = pgTable("saved_artists", {
  clerkUserId: text("clerk_user_id").notNull(),
  artistKey: text("artist_key").notNull(),
  artistName: text("artist_name").notNull(),
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.clerkUserId, table.artistKey] }),
  index("saved_artists_user_created_idx").on(table.clerkUserId, table.createdAt),
]);

export const monitoringSubscriptions = pgTable("monitoring_subscriptions", {
  stripeSubscriptionId: text("stripe_subscription_id").primaryKey(),
  clerkUserId: text("clerk_user_id").notNull(),
  artistKey: text("artist_key").notNull(),
  artistName: text("artist_name").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("monitoring_subscriptions_user_idx").on(table.clerkUserId, table.updatedAt),
]);

export type UserAccount = typeof userAccounts.$inferSelect;
export type SavedArtist = typeof savedArtists.$inferSelect;
export type MonitoringSubscription = typeof monitoringSubscriptions.$inferSelect;
