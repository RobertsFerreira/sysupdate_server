import { Elysia } from 'elysia'
import { env } from '@/config/env'
import { health, routes } from '@/routes/routes'

const app = new Elysia().use(health).use(routes).listen(env.SERVER_PORT)

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`)
