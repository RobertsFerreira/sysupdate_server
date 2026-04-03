import { env } from '@/config/env';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { schema } from './schemas/index';
import { Database } from "bun:sqlite";

const database = new Database(env.DATABASE_URL, {create: true});
export const db = drizzle(database, {
    schema,
	casing: 'snake_case',
});