import { customType, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const socialTemplateArtwork = pgTable("social_template_artwork", {
  templateKey: text("template_key").notNull(),
  entityType: text("entity_type").notNull(),
  entityKey: text("entity_key").notNull(),
  displayTitle: text("display_title").notNull(),
  displayArtist: text("display_artist").notNull().default(""),
  imageUrl: text("image_url").notNull(),
  imageData: bytea("image_data"),
  imageContentType: text("image_content_type"),
  source: text("source").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ name: "social_template_artwork_pkey", columns: [t.templateKey, t.entityType, t.entityKey] }),
  index("social_template_artwork_entity_idx").on(t.entityType, t.entityKey),
  index("social_template_artwork_seen_idx").on(t.templateKey, t.lastSeenAt),
]);

export type SocialTemplateArtwork = typeof socialTemplateArtwork.$inferSelect;
