// src/db/prepare.ts
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Database } from "bun:sqlite";
import { env } from "@/config/env";

const dbPath = env.DATABASE_URL.replace(/^file:/, "");
mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath, { create: true });
db.close();
