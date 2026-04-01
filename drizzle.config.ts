import { defineConfig } from 'drizzle-kit'
import { env } from '@/config/env'

export default defineConfig({
	schema: './src/db/schemas/**',
	out: './src/db/migrations',
	dialect: 'sqlite',
	dbCredentials: {
		url: env.DATABASE_URL,
	},
})
