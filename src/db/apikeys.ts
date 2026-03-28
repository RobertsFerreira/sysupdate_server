import { getDatabase } from "@/db/schemas";

export interface ApiKeyRecord {
  id: number;
  key_hash: string;
  label: string | null;
  allowed_ip: string;
  created_at: string;
  last_used: string | null;
  revoked: number;
}

const API_KEY_SELECT_COLUMNS = `
  id,
  key_hash,
  label,
  allowed_ip,
  created_at,
  last_used,
  revoked
`;

function selectApiKeyById(id: number): ApiKeyRecord | null {
  const db = getDatabase();

  return (
    db
      .query<ApiKeyRecord, [number]>(
        `
          SELECT ${API_KEY_SELECT_COLUMNS}
          FROM api_keys
          WHERE id = ?;
        `
      )
      .get(id) ?? null
  );
}

function selectActiveApiKeyByHash(keyHash: string): ApiKeyRecord | null {
  const db = getDatabase();

  return (
    db
      .query<ApiKeyRecord, [string]>(
        `
          SELECT ${API_KEY_SELECT_COLUMNS}
          FROM api_keys
          WHERE key_hash = ?
            AND revoked = 0
          LIMIT 1;
        `
      )
      .get(keyHash) ?? null
  );
}

export function insertApiKey(
  keyHash: string,
  ip: string,
  label: string | null = null
): ApiKeyRecord {
  const db = getDatabase();

  const result = db
    .query(
      `
        INSERT INTO api_keys (key_hash, label, allowed_ip)
        VALUES (?, ?, ?);
      `
    )
    .run(keyHash, label, ip);

  const apiKeyId = Number(result.lastInsertRowid);

  if (!Number.isInteger(apiKeyId) || apiKeyId <= 0) {
    throw new Error("Failed to create API key: invalid identifier.");
  }

  const apiKey = selectApiKeyById(apiKeyId);

  if (!apiKey) {
    throw new Error("Failed to load inserted API key from database.");
  }

  return apiKey;
}

export function findActiveApiKey(keyHash: string, ip: string): ApiKeyRecord | null {
  const apiKey = selectActiveApiKeyByHash(keyHash);

  if (!apiKey) return null;
  if (apiKey.allowed_ip !== ip) return null;

  return apiKey;
}

export function updateApiKeyLastUsed(keyHash: string): void {
  const db = getDatabase();

  db.query(
    `
      UPDATE api_keys
      SET last_used = CURRENT_TIMESTAMP
      WHERE key_hash = ?
        AND revoked = 0;
    `
  ).run(keyHash);
}

export function hasActiveKeyForIp(ip: string): boolean {
  const db = getDatabase();

  const result = db
    .query<{ count: number }, [string]>(
      `
        SELECT COUNT(*) AS count
        FROM api_keys
        WHERE allowed_ip = ?
          AND revoked = 0;
      `
    )
    .get(ip);

  return Number(result?.count ?? 0) > 0;
}
