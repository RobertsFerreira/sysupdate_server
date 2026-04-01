import { z } from "zod";
import fs from 'fs'

const DEFAULT_SERVER_PORT = 3000;


const requiredRegisterSecretSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().min(1, "Missing required environment variable: REGISTER_SECRET")
);

const dbPathSchema = z.string().refine(
  (path) => fs.existsSync(path), 
  { message: "Database file does not exist" }
);

const serverConfigSchema = z.object({
  DATABASE_URL: dbPathSchema,
  SERVER_PORT: z.coerce.number().int().positive().default(DEFAULT_SERVER_PORT),
  REGISTER_SECRET: requiredRegisterSecretSchema,
  STORAGE_PROVIDER: z.string().trim(),
  STORAGE_HOST: z.string().trim().default(""),
  STORAGE_USER: z.string().trim().default(""),
  STORAGE_PASSWORD: z.string().default(""),
  STORAGE_BASE_PATH: z.string().trim(),
});

export const env = serverConfigSchema.parse(process.env);
