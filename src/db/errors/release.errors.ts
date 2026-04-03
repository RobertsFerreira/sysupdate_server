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