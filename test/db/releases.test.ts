import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  getLatestRelease,
  getReleaseByVersion,
  getReleaseFiles,
  insertRelease,
} from "@/db/releases";
import { closeDatabase, initializeDatabase } from "@/db/schemas";

describe("db/releases", () => {
  let tempDir = "";
  let databasePath = "";

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "sysupdate-server-db-"));
    databasePath = join(tempDir, "sysupdate.db");
    initializeDatabase(databasePath);
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("creates database file and schema on initialization", () => {
    const db = initializeDatabase(databasePath);

    expect(existsSync(databasePath)).toBeTrue();

    const tables = db
      .query<{ name: string }, []>(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name IN ('releases', 'release_files')
          ORDER BY name;
        `
      )
      .all();

    expect(tables).toEqual([{ name: "release_files" }, { name: "releases" }]);
  });

  test("insertRelease persists release and release files", () => {
    const inserted = insertRelease({
      version: "2.4.1",
      description: "Correcoes de estabilidade",
      minVersion: "1.0.0",
      bundleFile: "release-2.4.1.zip",
      bundleChecksum: "bundle-checksum-241",
      releaseDate: "2026-03-21T14:00:00Z",
      files: [
        { target: "C:/SistemaX/app.exe", checksum: "checksum-app" },
        { target: "C:/SistemaX/config.json", checksum: "checksum-config" },
      ],
    });

    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.version).toBe("2.4.1");

    const loaded = getReleaseByVersion("2.4.1");
    expect(loaded).not.toBeNull();
    expect(loaded?.id).toBe(inserted.id);

    const files = getReleaseFiles(inserted.id);
    expect(files).toHaveLength(2);
    expect(files.map((file) => file.target)).toEqual([
      "C:/SistemaX/app.exe",
      "C:/SistemaX/config.json",
    ]);
  });

  test("getReleaseByVersion returns null when release does not exist", () => {
    expect(getReleaseByVersion("9.9.9")).toBeNull();
  });

  test("getLatestRelease returns highest semver release", () => {
    insertRelease({
      version: "2.9.0",
      bundleFile: "release-2.9.0.zip",
      bundleChecksum: "bundle-290",
      releaseDate: "2026-03-20T10:00:00Z",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-290" }],
    });

    insertRelease({
      version: "2.10.0",
      bundleFile: "release-2.10.0.zip",
      bundleChecksum: "bundle-2100",
      releaseDate: "2026-03-22T10:00:00Z",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-2100" }],
    });

    insertRelease({
      version: "2.3.5",
      bundleFile: "release-2.3.5.zip",
      bundleChecksum: "bundle-235",
      releaseDate: "2026-03-19T10:00:00Z",
      files: [{ target: "C:/SistemaX/app.exe", checksum: "checksum-235" }],
    });

    const latest = getLatestRelease();
    expect(latest).not.toBeNull();
    expect(latest?.version).toBe("2.10.0");
  });
});
