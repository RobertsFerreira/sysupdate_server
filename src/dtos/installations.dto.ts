import { z } from 'zod'
import { installationRoleSchema } from '@/db/schemas/installations.schema'

export const RegisterInstallationInputDTOSchema = z.object({
	installId: z.string().trim().min(1),
	publicKey: z.string().trim().min(1),
	label: z.string().trim().max(20).nullable().default(null),
})

export type RegisterInstallationInputDTO = z.infer<
	typeof RegisterInstallationInputDTOSchema
>

export const InstallationDTOSchema = RegisterInstallationInputDTOSchema.extend({
	id: z.number(),
	role: installationRoleSchema,
	registeredAt: z.coerce.date().nullable().optional().default(null),
	lastSeen: z.coerce.date().nullable().optional().default(null),
	revoked: z.number().int().default(0),
})

export type InstallationDTO = z.infer<typeof InstallationDTOSchema>

const SetInstallationRoleDTOSchema = z.object({
	installId: z.string().trim().min(1),
	role: installationRoleSchema,
})
export type SetInstallationRoleDTO = z.infer<
	typeof SetInstallationRoleDTOSchema
>

export function toInstallationDTO(data: Record<string, unknown>) {
	return InstallationDTOSchema.parse(data)
}
