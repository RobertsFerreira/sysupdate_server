export abstract class ReleaseDomainError extends Error {
  readonly code: string;

  protected constructor(message: string, code: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class InvalidReleaseVersionError extends ReleaseDomainError {
  readonly version: string;

  constructor(version: string) {
    super(
      `Invalid release version "${version}". Expected semver format.`,
      "INVALID_RELEASE_VERSION"
    );
    this.version = version;
  }
}

export class InvalidReleaseIdentifierError extends ReleaseDomainError {
  constructor() {
    super(
      "Failed to create release: invalid release identifier.",
      "INVALID_RELEASE_IDENTIFIER"
    );
  }
}

export class ReleaseLookupError extends ReleaseDomainError {
  constructor(message: string = "Failed to load release from database.") {
    super(message, "RELEASE_LOOKUP_FAILED");
  }
}

export class DuplicateReleaseVersionError extends ReleaseDomainError {
  readonly version: string;

  constructor(version: string) {
    super(`Release version "${version}" already exists.`, "DUPLICATE_RELEASE_VERSION");
    this.version = version;
  }
}
