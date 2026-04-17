export abstract class InstallationDomainError extends Error {
	readonly code: string

	protected constructor(message: string, code: string) {
		super(message)
		this.name = new.target.name
		this.code = code
	}
}

export class InstallationAlreadyExistsError extends InstallationDomainError {
	readonly installId: string

	constructor(installId: string) {
		super(
			`Installation "${installId}" already exists.`,
			'INSTALLATION_ALREADY_EXISTS',
		)
		this.installId = installId
	}
}

export class InstallationPersistenceError extends InstallationDomainError {
	constructor(message: string) {
		super(message, 'INSTALLATION_PERSISTENCE_ERROR')
	}
}

export class InstallationNotFoundError extends InstallationDomainError {
	readonly installId: string

	constructor(installId: string) {
		super(
			`Installation "${installId}" was not found.`,
			'INSTALLATION_NOT_FOUND',
		)
		this.installId = installId
	}
}

export class InvalidInstallationRoleError extends InstallationDomainError {
	readonly role: string

	constructor(role: string) {
		super(
			`Invalid installation role "${role}". Expected pending, consumer or publisher.`,
			'INVALID_INSTALLATION_ROLE',
		)
		this.role = role
	}
}
