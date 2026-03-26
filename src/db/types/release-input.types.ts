export interface ReleaseFileInput {
  target: string;
  checksum: string;
}

export interface InsertReleaseInput {
  version: string;
  description?: string | null;
  minVersion?: string | null;
  bundleFile: string;
  bundleChecksum: string;
  releaseDate: string;
  files: ReleaseFileInput[];
}
