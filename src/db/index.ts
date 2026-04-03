import { env } from '@/config/env';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { schema } from './schemas/index';

export const db = drizzle(env.DATABASE_URL, {
    schema,
	casing: 'snake_case',
});
