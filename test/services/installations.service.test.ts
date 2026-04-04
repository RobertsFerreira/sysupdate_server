import { join } from 'node:path'

import { createDb, type DbClient } from '@/db'
import { InstallationAlreadyExistsError, InstallationNotFoundError } from '@/db/errors/installation.errors'
import { installations } from '@/db/schemas/installations.schema'
import { createInstallationRepository } from '@/repositories/installations.repository'
import {
	createInstallationsService,
	type InstallationsService,
} from '@/services/installations.service'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { RegisterInstallationInputDTOSchema } from '@/dtos/installations.dto'

describe('services/installations', () => {
	let db: DbClient
	let installationsService: InstallationsService

	beforeAll(async () => {
		db = createDb(':memory:')
		const installationRepository = createInstallationRepository(db)
		installationsService = createInstallationsService(installationRepository)

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

	test('register_installation creates a new pending installation', () => {
		const installation = installationsService.registerInstallation({
			installId: 'service-install-1',
			publicKey: 'service-pub-key-1',
			label: 'ERP',
		})

		expect(installation.installId).toBe('service-install-1')
		expect(installation.role).toBe('pending')
		expect(installation.label).toBe('ERP')
	})

	test('register_installation throws conflict for duplicate install_id', () => {
		installationsService.registerInstallation(
			RegisterInstallationInputDTOSchema.parse({
				installId: 'service-install-dup',
				publicKey: 'service-pub-key-1',
			})
		)

		expect(() =>
			installationsService.registerInstallation(
				RegisterInstallationInputDTOSchema.parse({
					installId: 'service-install-dup',
					publicKey: 'service-pub-key-2',
				})
			),
		).toThrow(InstallationAlreadyExistsError)
	})

	test('update_installation_last_seen throws when installation does not exist', () => {
		expect(() =>
			installationsService.updateInstallationLastSeen('service-install-not-found'),
		).toThrow(InstallationNotFoundError)
	})

	test('set_installation_role throws when installation does not exist', () => {
		expect(() =>
			installationsService.setInstallationRole({
				installId: 'service-install-not-found',
				role: 'publisher',
			}),
		).toThrow(InstallationNotFoundError)
	})

	test('revoke_installation throws when installation does not exist', () => {
		expect(() =>
			installationsService.revokeInstallation('service-install-not-found'),
		).toThrow(InstallationNotFoundError)
	})
})
