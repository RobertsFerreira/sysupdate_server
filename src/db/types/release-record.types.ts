export interface ReleaseRecord {
  id: number;
  version: string;
  description: string | null;
  min_version: string | null;
  bundle_file: string;
  bundle_checksum: string;
  release_date: string;
  created_at: string;
}

export interface ReleaseFileRecord {
  id: number;
  release_id: number;
  target: string;
  checksum: string;
}
