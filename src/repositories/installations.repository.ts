import { and, eq, sql } from 'drizzle-orm'

import { db, type DbClient } from '@/db'
import {
	InstallationAlreadyExistsError,
	InstallationPersistenceError,
	InvalidInstallationRoleError,
} from '@/db/errors/installation.errors'
import {
	installationRoleSchema,
	type InstallationRole,
	installations,
} from '@/db/schemas/installations.schema'
import {
	type InstallationDTO,
	type RegisterInstallationInputDTO,
	type SetInstallationRoleDTO,
	toInstallationDTO,
} from '@/dtos/installations.dto'

function assertInstallationRole(role: string): InstallationRole {
	const parsedRole = installationRoleSchema.safeParse(role)

	if (!parsedRole.success) {
		throw new InvalidInstallationRoleError(role)
	}

	return parsedRole.data
}

export function createInstallationRepository(db: DbClient) {
	function insertInstallation(input: RegisterInstallationInputDTO): InstallationDTO {
		const existingInstallation = findInstallation(input.installId)

		if (existingInstallation) {
			throw new InstallationAlreadyExistsError(input.installId)
		}

		const insertedInstallation = db
			.insert(installations)
			.values(input)
			.returning()
			.get()

		if (!insertedInstallation) {
			throw new InstallationPersistenceError(
				'Failed to insert installation into database.',
			)
		}

		return toInstallationDTO(insertedInstallation)

	}

	function findInstallation(installId: string): InstallationDTO | null {
		const installation = db
			.select()
			.from(installations)
			.where(
				and(
					eq(installations.installId, installId),
					eq(installations.revoked, 0),
				),
			)
			.get()

		if (!installation) return null
		return toInstallationDTO(installation)
	}

	function updateInstallationLastSeen(installId: string): boolean {
		const updateResult = db
			.update(installations)
			.set({ lastSeen: sql`CURRENT_TIMESTAMP` })
			.where(
				and(
					eq(installations.installId, installId),
					eq(installations.revoked, 0),
				),
			)
			.returning()
			.get()

		return updateResult != null
	}

	function setInstallationRole(installation: SetInstallationRoleDTO): InstallationDTO | null {
		const validatedRole = assertInstallationRole(installation.role)

		const updatedInstallation = db
			.update(installations)
			.set({ role: validatedRole })
			.where(
				and(
					eq(installations.installId, installation.installId),
					eq(installations.revoked, 0),
				),
			)
			.returning()
			.get();

		if (!updatedInstallation) return null
		return toInstallationDTO(updatedInstallation)
	}

	function revokeInstallation(installId: string): boolean {
		const updateResult = db
			.update(installations)
			.set({ revoked: 1 })
			.where(
				and(
					eq(installations.installId, installId),
					eq(installations.revoked, 0),
				),
			)
			.returning()
			.get()

		return updateResult != null
	}

	return {
		insertInstallation,
		findInstallation,
		updateInstallationLastSeen,
		setInstallationRole,
		revokeInstallation,
	}
}

export type InstallationRepository = ReturnType<typeof createInstallationRepository>
export const installationRepository = createInstallationRepository(db)
