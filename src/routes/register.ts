import { Elysia, status } from 'elysia'
import { installationsService } from '@/services/installations.service'
import { RegisterInstallationInputDTOSchema } from '../dtos/installations.dto'

export const register = new Elysia({ prefix: '/register' })
	.decorate('installService', installationsService)
	.post(
		'/',
		({ body, installService }) => {
			try {
				const registered = installService.registerInstallation(body)
				if (!registered) {
					return status('Conflict', {
						code: 'INSTALL_ALREADY_REGISTERED',
						message: 'installation is already registered',
					})
				}

				return status('Created', {
					message: 'Installation registered successfully',
				})
			} catch {
				status('Internal Server Error', {
					code: 'REGISTER_FAILED',
					error: 'failed to register installation',
				})
			}
		},
		{
			body: RegisterInstallationInputDTOSchema,
		},
	)
