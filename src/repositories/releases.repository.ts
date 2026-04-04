import { eq } from 'drizzle-orm'
import semver from 'semver'

import { db, type DbClient } from '@/db/index'
import {
  InvalidReleaseVersionError,
  ReleaseAlreadyExistsError,
  ReleasePersistenceError,
} from '@/db/errors/release.errors'
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

    //TODO: trata possivel duplicidade vinda de dupla request no mesmo tempo
    //TODO: trata possivel insert vindo de install_id revogado
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
        .returning()
        .get()

      if (!insertedRelease) {
        throw new ReleasePersistenceError('Failed to insert release into database.')
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
