import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm/relations'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const releases = sqliteTable('releases', {
  id: integer("id").primaryKey({ autoIncrement: true }),
  version: text("version").notNull().unique(),
  description: text("description"),
  minVersion: text('min_version'),
  bundleFile: text('bundle_file').notNull(),
  bundleChecksum: text('bundle_checksum').notNull(),
  releaseDate: text('release_date').notNull(),
  publishedBy: text('published_by').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

export const releaseFiles = sqliteTable('release_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  releaseId: integer('release_id')
    .notNull()
    .references(() => releases.id, { onDelete: "cascade" }),
  target: text("target").notNull(),
  checksum: text("checksum").notNull(),
})

export const releasesRelations = relations(releases, ({ many }) => ({
  releaseFiles: many(releaseFiles),
}))

export const releaseFilesRelations = relations(releaseFiles, ({ one }) => ({
  release: one(releases, {
    fields: [releaseFiles.releaseId],
    references: [releases.id],
  }),
}))
