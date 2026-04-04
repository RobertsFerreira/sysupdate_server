import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

import { schema } from "./schemas/index";
import { env } from "@/config/env";

export function createDb(databaseUrl: string) {
  const database = new Database(databaseUrl, { create: true });
  database.run('PRAGMA foreign_keys=ON')

  return drizzle(database, {
    schema,
    casing: "snake_case",
  });
}

export type DbClient = ReturnType<typeof createDb>;
export const db = createDb(env.DATABASE_URL);
