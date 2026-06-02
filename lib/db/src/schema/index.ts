// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

export * from "./artist_images";
export * from "./kworb_coverage";
export * from "./kworb_snapshots";
export * from "./kworb_jobs";
export * from "./deezer_track_covers";
export * from "./youtube_channels";
export * from "./youtube_channel_daily_snapshots";
export * from "./youtube_channel_candidates";
export * from "./youtube_videos";
export * from "./spotify_artists";
export * from "./musicbrainz_artists";
export * from "./newsletter_subscribers";
export * from "./artist_discovery";
