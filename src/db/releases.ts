import semver from "semver";

import {
  DuplicateReleaseVersionError,
  InvalidReleaseIdentifierError,
  InvalidReleaseVersionError,
  ReleaseLookupError,
} from "@/db/errors/release.errors";
import { getDatabase } from "@/db/schemas";
import type {
  InsertReleaseInput,
} from "@/db/types/release-input.types";

import type {
  ReleaseFileRecord,
  ReleaseRecord,
} from "@/db/types/release-record.types";

  

const RELEASE_SELECT_COLUMNS = `
  id,
  version,
  description,
  min_version,
  bundle_file,
  bundle_checksum,
  release_date,
  created_at
`;

function selectReleaseById(releaseId: number): ReleaseRecord | null {
  const db = getDatabase();

  return (
    db
      .query<ReleaseRecord, [number]>(
        `
          SELECT ${RELEASE_SELECT_COLUMNS}
          FROM releases
          WHERE id = ?;
        `
      )
      .get(releaseId) ?? null
  );
}

function selectAllReleases(): ReleaseRecord[] {
  const db = getDatabase();

  return db
    .query<ReleaseRecord, []>(
      `
        SELECT ${RELEASE_SELECT_COLUMNS}
        FROM releases;
      `
    )
    .all();
}

function assertValidVersion(version: string): string {
  const normalized = semver.valid(version);

  if (!normalized) throw new InvalidReleaseVersionError(version);

  return normalized;
}

export function insertRelease(data: InsertReleaseInput): ReleaseRecord {
  const version = assertValidVersion(data.version);
  const db = getDatabase();

  const insertReleaseTransaction = db.transaction(
    (input: InsertReleaseInput, normalizedVersion: string): ReleaseRecord => {
      const insertReleaseResult = db
        .query(
          `
            INSERT INTO releases (
              version,
              description,
              min_version,
              bundle_file,
              bundle_checksum,
              release_date
            )
            VALUES (?, ?, ?, ?, ?, ?);
          `
        )
        .run(
          normalizedVersion,
          input.description ?? null,
          input.minVersion ?? null,
          input.bundleFile,
          input.bundleChecksum,
          input.releaseDate
        );

      const releaseId = Number(insertReleaseResult.lastInsertRowid);

      if (!Number.isInteger(releaseId) || releaseId <= 0) {
        throw new InvalidReleaseIdentifierError();
      }

      const insertReleaseFileStatement = db.query(
        `
          INSERT INTO release_files (release_id, target, checksum)
          VALUES (?, ?, ?);
        `
      );

      for (const file of input.files) {
        insertReleaseFileStatement.run(releaseId, file.target, file.checksum);
      }

      const releaseFromDb = selectReleaseById(releaseId);

      if (!releaseFromDb) {
        throw new ReleaseLookupError("Failed to load inserted release from database.");
      }

      return releaseFromDb;
    }
  );

  try {
    return insertReleaseTransaction(data, version);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: releases.version")
    ) {
      throw new DuplicateReleaseVersionError(version);
    }

    throw error;
  }
}

export function getLatestRelease(): ReleaseRecord | null {
  const releases = selectAllReleases();

  const validReleases = releases.filter((release) => semver.valid(release.version));

  if (validReleases.length === 0) return null;

  validReleases.sort((left, right) => semver.rcompare(left.version, right.version));

  return validReleases[0] ?? null;
}

export function getReleaseByVersion(version: string): ReleaseRecord | null {
  const normalizedVersion = assertValidVersion(version);
  const db = getDatabase();

  const release = db
    .query<ReleaseRecord, [string]>(
      `
        SELECT ${RELEASE_SELECT_COLUMNS}
        FROM releases
        WHERE version = ?;
      `
    )
    .get(normalizedVersion);

  return release ?? null;
}

export function getReleaseFiles(releaseId: number): ReleaseFileRecord[] {
  const db = getDatabase();

  return db
    .query<ReleaseFileRecord, [number]>(
      `
        SELECT
          id,
          release_id,
          target,
          checksum
        FROM release_files
        WHERE release_id = ?
        ORDER BY id ASC;
      `
    )
    .all(releaseId);
}
