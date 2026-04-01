import { env } from '@/config/env';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { schema } from './schemas/index';

const db = drizzle(env.DATABASE_URL, {
    schema,
	casing: 'snake_case',
});
