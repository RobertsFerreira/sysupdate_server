export abstract class ReleaseDomainError extends Error {
	readonly code: string

	protected constructor(message: string, code: string) {
		super(message)
		this.name = new.target.name
		this.code = code
	}
}

export class InvalidReleaseVersionError extends ReleaseDomainError {
	readonly version: string

	constructor(version: string) {
		super(
			`Invalid release version "${version}". Expected semver format.`,
			'INVALID_RELEASE_VERSION',
		)
		this.version = version
	}
}

export class ReleaseAlreadyExistsError extends ReleaseDomainError {
	readonly version: string

	constructor(version: string) {
		super(`Release "${version}" already exists.`, 'RELEASE_ALREADY_EXISTS')
		this.version = version
	}
}

export class ReleasePersistenceError extends ReleaseDomainError {
	constructor(message: string) {
		super(message, 'RELEASE_PERSISTENCE_ERROR')
	}
}

export class ReleasePublisherNotAllowedError extends ReleaseDomainError {
	readonly installId: string

	constructor(installId: string) {
		super(
			`Installation "${installId}" is not allowed to publish releases.`,
			'RELEASE_PUBLISHER_NOT_ALLOWED',
		)
		this.installId = installId
	}
}
