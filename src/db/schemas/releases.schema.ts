import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm/relations";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const releases = sqliteTable("releases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  version: text("version").notNull().unique(),
  description: text("description"),
  min_version: text("min_version"),
  bundle_file: text("bundle_file").notNull(),
  bundle_checksum: text("bundle_checksum").notNull(),
  release_date: text("release_date").notNull(),
  published_by: text("published_by").notNull(),
  created_at: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const releaseFiles = sqliteTable("release_files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  release_id: integer("release_id")
    .notNull()
    .references(() => releases.id, { onDelete: "cascade" }),
  target: text("target").notNull(),
  checksum: text("checksum").notNull(),
});

export const releasesRelations = relations(releases, ({ many }) => ({
  releaseFiles: many(releaseFiles),
}));

export const releaseFilesRelations = relations(releaseFiles, ({ one }) => ({
  release: one(releases, {
    fields: [releaseFiles.release_id],
    references: [releases.id],
  }),
}));
