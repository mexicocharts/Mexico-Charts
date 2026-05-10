import { pgTable, text } from "drizzle-orm/pg-core";

export const artistImages = pgTable("artist_images", {
  artistKey: text("artist_key").primaryKey(),
  imageUrl:  text("image_url").notNull(),
});

export type ArtistImage = typeof artistImages.$inferSelect;
