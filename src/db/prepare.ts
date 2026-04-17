// src/db/prepare.ts

import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { env } from '@/config/env'

const dbPath = env.DATABASE_URL.replace(/^file:/, '')
mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath, { create: true })
db.close()
