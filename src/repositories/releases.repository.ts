import { eq } from "drizzle-orm";
import semver from "semver";

import { InvalidReleaseVersionError } from "@/db/errors/release.errors";
import { releaseFiles, releases } from "../db/schemas/releases.schema";
import {
  ReleaseHeaderDTOSchema,
  toReleaseDTO,
  type InsertReleaseDTO,
  type ReleaseHeaderDTO,
  type ReleaseResponseDTO,
  type ReleasesResponseDTO,
} from "../dtos/releases.dto";
import { db , type DbClient} from "@/db/index";

export function createReleaseRepository(db: DbClient) {
  function selectAllReleases(): ReleasesResponseDTO {
    const rows = db
      .select()
      .from(releases)
      .innerJoin(releaseFiles, eq(releaseFiles.release_id, releases.id))
      .all();

    const grouped = new Map<number, ReleaseResponseDTO>();

    for (const row of rows) {
      const release = row.releases;
      const releaseFile = row.release_files;

      const existing = grouped.get(release.id);
      if (existing) {
        existing.files.push({
          id: releaseFile.id,
          target: releaseFile.target,
          checksum: releaseFile.checksum,
        });
        continue;
      }

      grouped.set(release.id, {
        ...release,
        files: [
          {
            id: releaseFile.id,
            target: releaseFile.target,
            checksum: releaseFile.checksum,
          },
        ],
      });
    }

    return Array.from(grouped.values()).map(toReleaseDTO);
  }

  function assertValidVersion(version: string): string {
    const normalized = semver.valid(version);
    if (!normalized) throw new InvalidReleaseVersionError(version);
    return normalized;
  }

  function insertRelease(release: InsertReleaseDTO): ReleaseHeaderDTO {
    assertValidVersion(release.version);

    return db.transaction((tx) => {
      const { files, ...releaseData } = release;
      const insertedRelease = tx.insert(releases).values(releaseData).returning().get();

      if (!insertedRelease) throw new Error("Failed to insert release");

      const currentFiles = files.map((file) => {
        return {
          release_id: insertedRelease.id,
          ...file,
        };
      });

      const filesInserted = tx.insert(releaseFiles).values(currentFiles).returning().all();
      if (filesInserted.length !== currentFiles.length) throw new Error("Failed to insert release files");

      return ReleaseHeaderDTOSchema.parse(insertedRelease);
    });
  }

  function get_latest_release(): ReleaseResponseDTO | null {
    const releasesList = selectAllReleases();

    const validReleases = releasesList
      .filter((release) => semver.valid(release.version))
      .sort((left, right) => semver.rcompare(left.version, right.version));

    return validReleases.at(0) ?? null;
  }

  function get_release_by_version(version: string): ReleaseResponseDTO | null {
    const normalizedVersion = assertValidVersion(version);
    const release = db.select().from(releases).where(eq(releases.version, normalizedVersion)).get();

    if (!release) return null;

    const files = db
      .select()
      .from(releaseFiles)
      .where(eq(releaseFiles.release_id, release.id))
      .all()
      .map((file) => ({
        id: file.id,
        target: file.target,
        checksum: file.checksum,
      }));

    return toReleaseDTO({
      ...release,
      files,
    });
  }

  return {
    insert_release: insertRelease,
    get_latest_release,
    get_release_by_version,
  };
}

export type ReleaseRepository = ReturnType<typeof createReleaseRepository>;
export const release_repository = createReleaseRepository(db);