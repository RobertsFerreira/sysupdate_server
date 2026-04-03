import { z } from "zod";
import fs from 'fs'

const DEFAULT_SERVER_PORT = 3000;


const serverConfigSchema = z.object({
  DATABASE_URL: z.string(),
  SERVER_PORT: z.coerce.number().int().positive().default(DEFAULT_SERVER_PORT),
  //TODO: passar para uso de enum
  STORAGE_PROVIDER: z.string().trim(),
  //TODO: remover default e tornar obrigatorio
  STORAGE_HOST: z.string().trim().default(''),
  STORAGE_USER: z.string().trim().default(''),
  STORAGE_PASSWORD: z.string().default(''),
  STORAGE_BASE_PATH: z.string().trim().default(''),
});

export const env = serverConfigSchema.parse(process.env);
