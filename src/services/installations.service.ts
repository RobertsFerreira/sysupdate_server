import { InstallationNotFoundError } from '@/db/errors/installation.errors'
import type {
	InstallationDTO,
	RegisterInstallationInputDTO,
	SetInstallationRoleDTO,
} from '@/dtos/installations.dto'
import {
	type InstallationRepository,
	installationRepository,
} from '@/repositories/installations.repository'

export function createInstallationsService(repository: InstallationRepository) {
	function registerInstallation(
		input: RegisterInstallationInputDTO,
	): InstallationDTO {
		return repository.insertInstallation(input)
	}

	function findInstallation(installId: string): InstallationDTO | null {
		return repository.findInstallation(installId)
	}

	function updateInstallationLastSeen(installId: string): void {
		const updated = repository.updateInstallationLastSeen(installId)
		if (!updated) {
			throw new InstallationNotFoundError(installId)
		}
	}

	function setInstallationRole(
		installation: SetInstallationRoleDTO,
	): InstallationDTO {
		const updated = repository.setInstallationRole(installation)
		if (!updated) {
			throw new InstallationNotFoundError(installation.installId)
		}

		return updated
	}

	function revokeInstallation(installId: string): void {
		const updated = repository.revokeInstallation(installId)
		if (!updated) {
			throw new InstallationNotFoundError(installId)
		}
	}

	return {
		registerInstallation,
		findInstallation,
		updateInstallationLastSeen,
		setInstallationRole,
		revokeInstallation,
	}
}

export type InstallationsService = ReturnType<typeof createInstallationsService>

export const installationsService = createInstallationsService(
	installationRepository,
)
