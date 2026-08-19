import { boolean, index, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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

export const fanProfiles = pgTable("fan_profiles", {
  clerkUserId: text("clerk_user_id").primaryKey(),
  username: text("username").notNull().unique("fan_profiles_username_key"),
  displayName: text("display_name"),
  bio: text("bio"),
  accountType: text("account_type").notNull().default("personal"),
  isPublic: boolean("is_public").notNull().default(false),
  showRecentListening: boolean("show_recent_listening").notNull().default(false),
  showBadges: boolean("show_badges").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("fan_profiles_username_idx").on(table.username),
]);

export const userMusicConnections = pgTable("user_music_connections", {
  clerkUserId: text("clerk_user_id").notNull(),
  provider: text("provider").notNull(),
  externalUserId: text("external_user_id"),
  externalUsername: text("external_username"),
  accessTokenEncrypted: text("access_token_encrypted"),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  scopes: text("scopes"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ name: "user_music_connections_pkey", columns: [table.clerkUserId, table.provider] }),
  index("user_music_connections_user_idx").on(table.clerkUserId, table.updatedAt.desc().nullsFirst()),
]);

export const userListeningEvents = pgTable("user_listening_events", {
  clerkUserId: text("clerk_user_id").notNull(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  playedAt: timestamp("played_at", { withTimezone: true }).notNull(),
  trackId: text("track_id"),
  trackName: text("track_name").notNull(),
  artistName: text("artist_name").notNull(),
  albumName: text("album_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ name: "user_listening_events_pkey", columns: [table.clerkUserId, table.provider, table.eventId] }),
  index("user_listening_events_recent_idx").on(table.clerkUserId, table.playedAt.desc().nullsFirst()),
]);

export const savedArtists = pgTable("saved_artists", {
  clerkUserId: text("clerk_user_id").notNull(),
  artistKey: text("artist_key").notNull(),
  artistName: text("artist_name").notNull(),
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ name: "saved_artists_pkey", columns: [table.clerkUserId, table.artistKey] }),
  index("saved_artists_user_created_idx").on(table.clerkUserId, table.createdAt.desc().nullsFirst()),
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
  index("monitoring_subscriptions_user_idx").on(table.clerkUserId, table.updatedAt.desc().nullsFirst()),
]);

export type UserAccount = typeof userAccounts.$inferSelect;
export type FanProfile = typeof fanProfiles.$inferSelect;
export type UserMusicConnection = typeof userMusicConnections.$inferSelect;
export type UserListeningEvent = typeof userListeningEvents.$inferSelect;
export type SavedArtist = typeof savedArtists.$inferSelect;
export type MonitoringSubscription = typeof monitoringSubscriptions.$inferSelect;
