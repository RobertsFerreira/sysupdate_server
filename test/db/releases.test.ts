import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";

type ReleaseService = typeof import("@/repositories/releases").release_repository;

describe("db/releases", () => {
  let sqlite: Database;
  let releaseService: ReleaseService;
  let dbModule: typeof import("@/db/index");

  let tempDir = "";
  let databasePath = "";

  beforeAll(async () => {
    tempDir = mkdtempSync(join(tmpdir(), "sysupdate-server-db-"));
    databasePath = join(tempDir, "sysupdate.db");
    writeFileSync(databasePath, "");

    process.env.DATABASE_URL = databasePath;
    process.env.REGISTER_SECRET = "test-register-secret";
    process.env.STORAGE_PROVIDER = "local";
    process.env.STORAGE_HOST = "localhost";
    process.env.STORAGE_USER = "test-user";
    process.env.STORAGE_PASSWORD = "test-password";
    process.env.STORAGE_BASE_PATH = "/tmp";

    sqlite = new Database(databasePath, { create: true });
    sqlite.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS releases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        description TEXT,
        min_version TEXT,
        bundle_file TEXT NOT NULL,
        bundle_checksum TEXT NOT NULL,
        release_date TEXT NOT NULL,
        published_by TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS release_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
        target TEXT NOT NULL,
        checksum TEXT NOT NULL
      );
    `);

    ({ release_service: releaseService } = await import("@/repositories/releases"));
    dbModule = await import("@/db/index");
  });

  beforeEach(() => {
    sqlite.exec(`
      DELETE FROM release_files;
      DELETE FROM releases;
    `);
  });

  afterAll(() => {
    sqlite.close();
    dbModule.db.$client.close();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // SQLite can keep a transient lock on Windows after closing.
    }
  });

  test("creates database file and schema on initialization", () => {
    expect(existsSync(databasePath)).toBeTrue();

    const tables = sqlite
      .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('releases', 'release_files') ORDER BY name;")
      .all();

    expect(tables).toEqual([{ name: "release_files" }, { name: "releases" }]);
  });

  test("insert_release persists release and release files", () => {
    const inserted = releaseService.insert_release({
      version: "2.4.1",
      description: "Correcoes de estabilidade",
      min_version: "1.0.0",
      bundle_file: "release-2.4.1.zip",
      bundle_checksum: "bundle-checksum-241",
      release_date: "2026-03-21T14:00:00Z",
      published_by: "publisher-1",
      files: [
        { target: "C:/SistemaX/app.exe", checksum: "checksum-app" },
        { target: "C:/SistemaX/config.json", checksum: "checksum-config" },
      ],
    });

    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.version).toBe("2.4.1");

    const loaded = releaseService.get_release_by_version("2.4.1");
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(inserted.id);
    expect(loaded?.files).toHaveLength(2);
    expect(loaded?.files.map((file) => file.target)).toEqual([
      "C:/SistemaX/app.exe",
      "C:/SistemaX/config.json",
    ]);
  });

  test("get_release_by_version returns null when release does not exist", () => {
    expect(releaseService.get_release_by_version("9.9.9")).toBeNull();
  });

  test("get_latest_release returns highest semver release", () => {
    releaseService.insert_release({
      version: "2.9.0",
      description: "2.9.0",
      min_version: "1.0.0",
      bundle_file: "release-2.9.0.zip",
      bundle_checksum: "bundle-290",
      release_date: "2026-03-20T10:00:00Z",
      published_by: "publisher-1",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-290" }],
    });

    releaseService.insert_release({
      version: "2.10.0",
      description: "2.10.0",
      min_version: "1.0.0",
      bundle_file: "release-2.10.0.zip",
      bundle_checksum: "bundle-2100",
      release_date: "2026-03-22T10:00:00Z",
      published_by: "publisher-1",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-2100" }],
    });

    releaseService.insert_release({
      version: "2.3.5",
      description: "2.3.5",
      min_version: "1.0.0",
      bundle_file: "release-2.3.5.zip",
      bundle_checksum: "bundle-235",
      release_date: "2026-03-19T10:00:00Z",
      published_by: "publisher-1",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-235" }],
    });

    const latest = releaseService.get_latest_release();
    expect(latest).not.toBeNull();
    expect(latest?.version).toBe("2.10.0");
  });
});
