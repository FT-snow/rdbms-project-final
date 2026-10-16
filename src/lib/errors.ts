/** Maps raw driver/network errors to precise, human explanations. */

export interface ErrorDescription {
  code: string;
  summary: string;
  detail?: string;
}

export function describeDbError(error: unknown): ErrorDescription {
  const e = error as { code?: string; message?: string; errno?: number };
  const code = e?.code ?? "ERR";
  const message = e?.message ?? String(error);

  const map: Record<string, ErrorDescription> = {
    ER_ACCESS_DENIED_ERROR: {
      code,
      summary: "MySQL rejected the username or password.",
      detail: "Check DB_USER and DB_PASSWORD in the deployment environment variables.",
    },
    ER_BAD_DB_ERROR: {
      code,
      summary: `Database "${e?.message?.match(/Unknown database '(.+)'/)?.[1] ?? "…"}" does not exist.`,
      detail: "Run sql/schema.sql against this host (bun run scripts/run-schema.ts <host> <port> <user> <pass>).",
    },
    ER_NO_SUCH_TABLE: {
      code,
      summary: "Connected, but expected tables are missing.",
      detail: "The schema was never applied to this database — run sql/schema.sql.",
    },
    ECONNREFUSED: {
      code,
      summary: "Nothing is listening at DB_HOST:DB_PORT.",
      detail: "Wrong host/port, or the database server is down.",
    },
    ENOTFOUND: {
      code,
      summary: "DB_HOST does not resolve (DNS failure).",
      detail: "Typo in the hostname, or a private hostname used where only a public one works.",
    },
    ETIMEDOUT: {
      code,
      summary: "Connection timed out.",
      detail: "A firewall or security list is blocking the deployment platform's IPs, or the port is wrong.",
    },
    ER_HOST_NOT_PRIVILEGED: {
      code,
      summary: "The database refuses connections from this host.",
      detail: "Add the platform's IP range to the DB's allowed hosts / traffic filter.",
    },
    ER_NOT_SUPPORTED_AUTH_MODE: {
      code,
      summary: "Auth plugin not supported by the mysql2 driver.",
      detail: "Use mysql_native_password or caching_sha2_password-compatible settings.",
    },
    HANDSHAKE_NO_SSL_SUPPORT: {
      code,
      summary: "Server rejected the TLS handshake.",
      detail: "Toggle DB_SSL (true for TiDB/PlanetScale/Aiven, false for plain localhost).",
    },
    ERR_TLS_CERT_ALTNAME_INVALID: {
      code,
      summary: "TLS certificate hostname mismatch.",
      detail: "The DB hostname doesn't match its certificate — verify DB_HOST spelling.",
    },
    UNABLE_TO_VERIFY_LEAF_SIGNATURE: {
      code,
      summary: "TLS certificate could not be verified.",
      detail: "Set DB_SSL=false if the server uses a self-signed certificate.",
    },
  };

  // TiDB reports auth failures as generic errno 1105 with "Access denied"
  // in the message instead of the classic ER_ACCESS_DENIED_ERROR code.
  if (code === "ER_UNKNOWN_ERROR" && /access denied/i.test(message)) {
    return {
      code: "ACCESS_DENIED (errno 1105)",
      summary: "MySQL rejected the username or password.",
      detail:
        "TiDB Serverless usernames need their full cluster prefix (e.g. 'abc123.root'). " +
        "Verify DB_USER and DB_PASSWORD in the deployment env vars — no quotes, no stray spaces.",
    };
  }

  return (
    map[code] ?? {
      code,
      summary: message.slice(0, 200),
      detail: "Full text is in the deployment's runtime logs.",
    }
  );
}

/** One-line rendering for banners and fallback screens. */
export function formatDbError(error: unknown): string {
  const { code, summary, detail } = describeDbError(error);
  return `${code}: ${summary}${detail ? ` ${detail}` : ""}`;
}
