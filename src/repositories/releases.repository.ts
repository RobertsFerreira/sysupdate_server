import { eq } from 'drizzle-orm'
import semver from 'semver'

import { db, type DbClient } from '@/db/index'
import {
  InvalidReleaseVersionError,
  ReleaseAlreadyExistsError,
  ReleasePersistenceError,
  ReleasePublisherNotAllowedError,
} from '@/db/errors/release.errors'
import { installations } from '@/db/schemas/installations.schema'
import { releaseFiles, releases } from '../db/schemas/releases.schema'
import {
  ReleaseHeaderDTOSchema,
  toReleaseDTO,
  type InsertReleaseDTO,
  type ReleaseHeaderDTO,
  type ReleaseResponseDTO,
  type ReleasesResponseDTO,
} from '../dtos/releases.dto'

export function createReleaseRepository(db: DbClient) {
  function assertPublisherCanPublish(installId: string): void {
    const installation = db
      .select({
        installId: installations.installId,
        role: installations.role,
        revoked: installations.revoked,
      })
      .from(installations)
      .where(eq(installations.installId, installId))
      .get()

    if (!installation) {
      throw new ReleasePublisherNotAllowedError(installId)
    }

    const hasPublisherRole = installation.role === 'publisher'
    const isRevoked = installation.revoked === 1
    if (isRevoked || !hasPublisherRole) {
      throw new ReleasePublisherNotAllowedError(installId)
    }
  }

  function selectAllReleases(): ReleasesResponseDTO {
    const rows = db
      .select()
      .from(releases)
      .innerJoin(releaseFiles, eq(releaseFiles.releaseId, releases.id))
      .all()

    const grouped = new Map<number, ReleaseResponseDTO>()

    for (const row of rows) {
      const release = row.releases
      const releaseFile = row.release_files

      const existing = grouped.get(release.id)
      if (existing) {
        existing.files.push({
          id: releaseFile.id,
          target: releaseFile.target,
          checksum: releaseFile.checksum,
        })
        continue
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
      })
    }

    return Array.from(grouped.values()).map(toReleaseDTO)
  }

  function assertValidVersion(version: string): string {
    const normalized = semver.valid(version)
    if (!normalized) throw new InvalidReleaseVersionError(version)
    return normalized
  }

  function insertRelease(release: InsertReleaseDTO): ReleaseHeaderDTO {
    const normalizedVersion = assertValidVersion(release.version)
    assertPublisherCanPublish(release.publishedBy)

    const existingRelease = getReleaseByVersion(normalizedVersion)

    if (existingRelease) {
      throw new ReleaseAlreadyExistsError(normalizedVersion)
    }

    return db.transaction((tx) => {
      const { files, ...releaseData } = release
      const insertedRelease = tx
        .insert(releases)
        .values({
          ...releaseData,
          version: normalizedVersion,
        })
        .onConflictDoNothing({ target: releases.version })
        .returning()
        .get()

      // Covers race condition where another request inserted the same version first.
      if (!insertedRelease) {
        throw new ReleaseAlreadyExistsError(normalizedVersion)
      }

      const currentFiles = files.map((file) => {
        return {
          releaseId: insertedRelease.id,
          ...file,
        }
      })

      const filesInserted = tx
        .insert(releaseFiles)
        .values(currentFiles)
        .returning()
        .all()
      if (filesInserted.length !== currentFiles.length) {
        throw new ReleasePersistenceError('Failed to insert release files.')
      }

      return ReleaseHeaderDTOSchema.parse(insertedRelease)
    })
  }

  function getLatestRelease(): ReleaseResponseDTO | null {
    const releasesList = selectAllReleases()

    const validReleases = releasesList
      .filter((release) => semver.valid(release.version))
      .sort((left, right) => semver.rcompare(left.version, right.version))

    return validReleases.at(0) ?? null
  }

  function getReleaseByVersion(version: string): ReleaseResponseDTO | null {
    const normalizedVersion = assertValidVersion(version)
    const release = db
      .select()
      .from(releases)
      .where(eq(releases.version, normalizedVersion))
      .get()

    if (!release) return null

    const files = db
      .select()
      .from(releaseFiles)
      .where(eq(releaseFiles.releaseId, release.id))
      .all()
      .map((file) => ({
        id: file.id,
        target: file.target,
        checksum: file.checksum,
      }))

    return toReleaseDTO({
      ...release,
      files,
    })
  }

  return {
    insertRelease,
    getLatestRelease,
    getReleaseByVersion,
  }
}

export type ReleaseRepository = ReturnType<typeof createReleaseRepository>
export const releaseRepository = createReleaseRepository(db)
