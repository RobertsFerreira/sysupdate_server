import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from 'bun:test'
import { join } from 'node:path'
import { createDb, type DbClient } from '@/db'
import { InstallationAlreadyExistsError } from '@/db/errors/installation.errors'
import { installations } from '@/db/schemas/installations.schema'
import { RegisterInstallationInputDTOSchema } from '@/dtos/installations.dto'
import {
	createInstallationRepository,
	type InstallationRepository,
} from '@/repositories/installations.repository'

describe('db/installations', () => {
	let installationRepository: InstallationRepository
	let db: DbClient

	beforeAll(async () => {
		db = createDb(':memory:')
		installationRepository = createInstallationRepository(db)

		const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')
		const migrationsFolder = join(import.meta.dir, '../../src/db/migrations')
		migrate(db, { migrationsFolder })
	})

	beforeEach(() => {
		db.delete(installations).run()
	})

	afterAll(() => {
		db.$client.close()
	})

	test('insert_installation persists role pending by default', () => {
		const inserted = installationRepository.insertInstallation({
			installId: 'install-1',
			publicKey: 'public-key-1',
			label: 'Publisher A',
		})

		expect(inserted.id).toBeGreaterThan(0)
		expect(inserted.installId).toBe('install-1')
		expect(inserted.role).toBe('pending')
		expect(inserted.revoked).toBe(0)
	})

	test('insert_installation throws when install_id already exists', () => {
		installationRepository.insertInstallation(
			RegisterInstallationInputDTOSchema.parse({
				installId: 'install-dup',
				publicKey: 'pub-key-1',
			}),
		)

		expect(() =>
			installationRepository.insertInstallation(
				RegisterInstallationInputDTOSchema.parse({
					installId: 'install-dup',
					publicKey: 'pub-key-2',
				}),
			),
		).toThrow(InstallationAlreadyExistsError)
	})

	test('find_installation returns null for revoked installation', () => {
		installationRepository.insertInstallation(
			RegisterInstallationInputDTOSchema.parse({
				installId: 'install-revoked',
				publicKey: 'public-key',
			}),
		)
		const revoked = installationRepository.revokeInstallation('install-revoked')

		expect(revoked).toBeTrue()
		expect(
			installationRepository.findInstallation('install-revoked'),
		).toBeNull()
	})

	test('update_installation_last_seen updates only active installation', () => {
		installationRepository.insertInstallation(
			RegisterInstallationInputDTOSchema.parse({
				installId: 'install-last-seen',
				publicKey: 'public-key',
			}),
		)

		const updated =
			installationRepository.updateInstallationLastSeen('install-last-seen')

		expect(updated).toBeTrue()
		expect(
			installationRepository.findInstallation('install-last-seen')?.lastSeen,
		).not.toBeNull()
	})

	test('set_installation_role updates role for active installation', () => {
		installationRepository.insertInstallation(
			RegisterInstallationInputDTOSchema.parse({
				installId: 'install-role',
				publicKey: 'public-key',
			}),
		)

		const updated = installationRepository.setInstallationRole({
			installId: 'install-role',
			role: 'publisher',
		})

		expect(updated).not.toBeNull()
		expect(updated?.role).toBe('publisher')
	})

	test('revoke_installation returns false when install_id does not exist', () => {
		expect(installationRepository.revokeInstallation('not-found')).toBeFalse()
	})
})
