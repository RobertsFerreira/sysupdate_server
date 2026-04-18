import { Elysia } from 'elysia'
import { register } from './register'

export const health = new Elysia({ name: 'Health', tags: ['Health'] }).get(
	'/health',
	() => ({ status: 'OK' }),
)

export const routes = new Elysia({ name: 'routes', prefix: '/v1' }).use(
	register,
)
