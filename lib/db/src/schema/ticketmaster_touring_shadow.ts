import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const ticketmasterTouringShadowRuns = pgTable("ticketmaster_touring_shadow_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  status: text("status").notNull(),
  reason: text("reason").notNull(),
  requestedArtists: integer("requested_artists").notNull().default(0),
  successfulArtists: integer("successful_artists").notNull().default(0),
  failedArtists: integer("failed_artists").notNull().default(0),
  fetchedEvents: integer("fetched_events").notNull().default(0),
  savedEvents: integer("saved_events").notNull().default(0),
  concertEvents: integer("concert_events").notNull().default(0),
  addOnEvents: integer("addon_events").notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check(
    "ticketmaster_touring_shadow_runs_status_check",
    sql`${table.status} IN ('running','complete','partial','failed')`,
  ),
  index("ticketmaster_touring_shadow_runs_started_idx").on(table.startedAt.desc().nullsFirst()),
]);

export const ticketmasterTouringShadowEventSnapshots = pgTable("ticketmaster_touring_shadow_event_snapshots", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  runId: bigint("run_id", { mode: "number" })
    .notNull()
    .references(() => ticketmasterTouringShadowRuns.id, { onDelete: "restrict" }),
  artistKey: text("artist_key").notNull(),
  artistName: text("artist_name").notNull(),
  tourScope: text("tour_scope").notNull(),
  eventId: text("event_id").notNull(),
  eventName: text("event_name").notNull(),
  eventUrl: text("event_url"),
  eventClassification: text("event_classification").notNull(),
  isTrackableConcert: boolean("is_trackable_concert").notNull(),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time"),
  eventDateTbd: boolean("event_date_tbd").notNull().default(false),
  eventDateTba: boolean("event_date_tba").notNull().default(false),
  eventStatus: text("event_status"),
  publicSaleStartAt: timestamp("public_sale_start_at", { withTimezone: true }),
  publicSaleEndAt: timestamp("public_sale_end_at", { withTimezone: true }),
  publicSaleStartTbd: boolean("public_sale_start_tbd").notNull().default(false),
  publicSaleStartTba: boolean("public_sale_start_tba").notNull().default(false),
  publicSaleEndTbd: boolean("public_sale_end_tbd").notNull().default(false),
  publicSaleEndTba: boolean("public_sale_end_tba").notNull().default(false),
  priceMin: numeric("price_min"),
  priceMax: numeric("price_max"),
  priceCurrency: text("price_currency"),
  seatmapStaticUrl: text("seatmap_static_url"),
  ticketLimit: text("ticket_limit"),
  promoterId: text("promoter_id"),
  promoterName: text("promoter_name"),
  venueName: text("venue_name"),
  venueType: text("venue_type"),
  venueTimezone: text("venue_timezone"),
  venueCity: text("venue_city"),
  venueState: text("venue_state"),
  venueCountry: text("venue_country"),
  venueAddress: text("venue_address"),
  venueLatitude: numeric("venue_latitude"),
  venueLongitude: numeric("venue_longitude"),
  ticketsSold: bigint("tickets_sold", { mode: "number" }),
  remainingInventory: bigint("remaining_inventory", { mode: "number" }),
  sellThroughPercent: numeric("sell_through_percent"),
  capacity: bigint("capacity", { mode: "number" }),
  grossAmount: numeric("gross_amount"),
  inventoryDataConfidence: text("inventory_data_confidence")
    .notNull()
    .default("insufficient-inventory-data"),
  sourceMetadata: jsonb("source_metadata")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("ticketmaster_touring_shadow_event_run_unique").on(table.runId, table.eventId),
  index("ticketmaster_touring_shadow_events_event_idx").on(
    table.eventId,
    table.observedAt.desc().nullsFirst(),
  ),
  index("ticketmaster_touring_shadow_events_date_idx").on(
    table.eventDate,
    table.eventClassification,
  ),
  check(
    "ticketmaster_touring_shadow_event_classification_check",
    sql`${table.eventClassification} IN ('concert','add_on')`,
  ),
  check(
    "ticketmaster_touring_shadow_inventory_confidence_check",
    sql`
      ${table.inventoryDataConfidence} = 'insufficient-inventory-data'
      AND ${table.ticketsSold} IS NULL
      AND ${table.remainingInventory} IS NULL
      AND ${table.sellThroughPercent} IS NULL
      AND ${table.capacity} IS NULL
      AND ${table.grossAmount} IS NULL
    `,
  ),
]);

export type TicketmasterTouringShadowRun = typeof ticketmasterTouringShadowRuns.$inferSelect;
export type TicketmasterTouringShadowEventSnapshot =
  typeof ticketmasterTouringShadowEventSnapshots.$inferSelect;