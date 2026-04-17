import { Elysia } from 'elysia'

export const health = new Elysia({ name: 'Health', tags: ['Health'] }).get(
	'/health',
	() => ({ status: 'OK' }),
)

export const routes = new Elysia({ name: 'routes', prefix: '/v1' })
