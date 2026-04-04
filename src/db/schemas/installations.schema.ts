import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";

export const installationRoles = ["pending", "consumer", "publisher"] as const;
export const installationRoleSchema = z.enum(installationRoles);
export type InstallationRole = z.infer<typeof installationRoleSchema>;


export const installations = sqliteTable("installations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  installId: text("install_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  role: text("role", { enum: installationRoles }).notNull().default("pending"),
  label: text("label"),
  registeredAt: text("registered_at").default(sql`CURRENT_TIMESTAMP`),
  lastSeen: text("last_seen"),
  // 0 - Active | 1 - Revoked 
  revoked: integer("revoked").default(0),
});
