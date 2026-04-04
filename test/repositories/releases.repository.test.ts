import { join } from "node:path";
import { createDb, type DbClient } from "@/db";
import { releaseFiles, releases } from "@/db/schemas/releases.schema";
import {
  InvalidReleaseVersionError,
  ReleaseAlreadyExistsError,
} from "@/db/errors/release.errors";
import {
  createReleaseRepository,
  type ReleaseRepository,
} from "@/repositories/releases.repository";

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

describe("db/releases", () => {
  let releaseRepository: ReleaseRepository;
  let db: DbClient;

  beforeAll(async () => {
    db = createDb(":memory:");
    releaseRepository = createReleaseRepository(db);

    const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");
    const migrationsFolder = join(import.meta.dir, "../../src/db/migrations");
    migrate(db, { migrationsFolder });
  });

  beforeEach(() => {
    db.transaction((tx) => {
      tx.delete(releaseFiles).run();
      tx.delete(releases).run();
    });
  });

  afterAll(() => {
    db.$client.close();
  });

  test("creates schema on initialization", () => {
    expect(() => db.select().from(releases).all()).not.toThrow();
    expect(() => db.select().from(releaseFiles).all()).not.toThrow();
  });

  test("insert_release persists release and release files", () => {
    const inserted = releaseRepository.insertRelease({
      version: "2.4.1",
      description: "Correcoes de estabilidade",
      minVersion: "1.0.0",
      bundleFile: "release-2.4.1.zip",
      bundleChecksum: "bundle-checksum-241",
      releaseDate: "2026-03-21T14:00:00Z",
      publishedBy: "publisher-1",
      files: [
        { target: "C:/SistemaX/app.exe", checksum: "checksum-app" },
        { target: "C:/SistemaX/config.json", checksum: "checksum-config" },
      ],
    });

    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.version).toBe("2.4.1");

    const loaded = releaseRepository.getReleaseByVersion("2.4.1");
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(inserted.id);
    expect(loaded?.files).toHaveLength(2);
    expect(loaded?.files.map((file) => file.target).sort()).toEqual([
      "C:/SistemaX/app.exe",
      "C:/SistemaX/config.json",
    ].sort());
  });

  test("get_release_by_version returns null when release does not exist", () => {
    expect(releaseRepository.getReleaseByVersion("9.9.9")).toBeNull();
  });

  test("get_release_by_version throws for invalid semver", () => {
    expect(() => releaseRepository.getReleaseByVersion("invalid-version")).toThrow(
      InvalidReleaseVersionError,
    );
  });

  test("insert_release throws for invalid semver", () => {
    expect(() =>
      releaseRepository.insertRelease({
        version: "invalid-version",
        description: "Versao invalida",
        minVersion: "1.0.0",
        bundleFile: "release-invalid.zip",
        bundleChecksum: "bundle-invalid",
        releaseDate: "2026-03-21T14:00:00Z",
        publishedBy: "publisher-1",
        files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-app" }],
      }),
    ).toThrow(InvalidReleaseVersionError);
  });

  test("get_latest_release returns highest semver release", () => {
    releaseRepository.insertRelease({
      version: "2.9.0",
      description: "2.9.0",
      minVersion: "1.0.0",
      bundleFile: "release-2.9.0.zip",
      bundleChecksum: "bundle-290",
      releaseDate: "2026-03-20T10:00:00Z",
      publishedBy: "publisher-1",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-290" }],
    });

    releaseRepository.insertRelease({
      version: "2.10.0",
      description: "2.10.0",
      minVersion: "1.0.0",
      bundleFile: "release-2.10.0.zip",
      bundleChecksum: "bundle-2100",
      releaseDate: "2026-03-22T10:00:00Z",
      publishedBy: "publisher-1",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-2100" }],
    });

    releaseRepository.insertRelease({
      version: "2.3.5",
      description: "2.3.5",
      minVersion: "1.0.0",
      bundleFile: "release-2.3.5.zip",
      bundleChecksum: "bundle-235",
      releaseDate: "2026-03-19T10:00:00Z",
      publishedBy: "publisher-1",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-235" }],
    });

    const latest = releaseRepository.getLatestRelease();
    expect(latest).not.toBeNull();
    expect(latest?.version).toBe("2.10.0");
  });

  test("get_latest_release returns null when there are no releases", () => {
    const latest = releaseRepository.getLatestRelease();
    expect(latest).toBeNull();
  });

  test("insert_release fails when version already exists", () => {
    const payload = {
      version: "3.0.0",
      description: "3.0.0",
      minVersion: "1.0.0",
      bundleFile: "release-3.0.0.zip",
      bundleChecksum: "bundle-300",
      releaseDate: "2026-03-25T10:00:00Z",
      publishedBy: "publisher-1",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-300" }],
    };

    releaseRepository.insertRelease(payload);
    expect(() => releaseRepository.insertRelease(payload)).toThrow(
      ReleaseAlreadyExistsError,
    );
  });

  test("insert_release rolls back release when file insert fails", () => {
    const version = "4.0.0";

    expect(() =>
      releaseRepository.insertRelease({
        version,
        description: "4.0.0",
        minVersion: "1.0.0",
        bundleFile: "release-4.0.0.zip",
        bundleChecksum: "bundle-400",
        releaseDate: "2026-03-25T10:00:00Z",
        publishedBy: "publisher-1",
        files: [
          { target: "C:/SistemaX/app.exe", checksum: "checksum-400" },
          { target: "C:/SistemaX/config.json", checksum: null as unknown as string },
        ],
      }),
    ).toThrow();

    expect(releaseRepository.getReleaseByVersion(version)).toBeNull();
  });
});

