import { pool } from "@/lib/db";
import mysql from "mysql2/promise";

export const dynamic = "force-dynamic";

function mask(v?: string) {
  if (!v) return "MISSING";
  return `${v.slice(0, 4)}…${v.slice(-2)} (${v.length} chars)`;
}

async function tryDb(
  label: string,
  config: Record<string, unknown>,
  query: string
): Promise<string> {
  try {
    const conn = await mysql.createConnection(config as mysql.ConnectionOptions);
    const [rows] = await conn.query(query);
    await conn.end();
    return `✅ ${label}: ${(JSON.stringify(rows) ?? "").slice(0, 120)}`;
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    return `❌ ${label}: ${err.code ?? "ERR"} — ${err.message?.slice(0, 180)}`;
  }
}

export default async function DebugPage() {
  const env = {
    DB_HOST: process.env.DB_HOST,
    DB_PORT: process.env.DB_PORT,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_NAME: process.env.DB_NAME,
    DB_SSL: process.env.DB_SSL,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  const base = {
    host: env.DB_HOST ?? "localhost",
    port: Number(env.DB_PORT ?? 3306),
    user: env.DB_USER ?? "root",
    password: env.DB_PASSWORD ?? "",
    database: env.DB_NAME ?? "hospital_db",
    connectTimeout: 8000,
  };

  const results = await Promise.all([
    tryDb("SELECT 1 (no TLS)", { ...base }, "SELECT 1 AS ok"),
    tryDb(
      "SELECT 1 (TLS)",
      { ...base, ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } },
      "SELECT 1 AS ok"
    ),
    tryDb(
      "users count (TLS)",
      { ...base, ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } },
      "SELECT COUNT(*) AS users FROM users"
    ),
    tryDb(
      "appointments count (TLS)",
      { ...base, ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true } },
      "SELECT COUNT(*) AS appts FROM appointments"
    ),
    tryDb(
      "pool query (app config)",
      {},
      "SELECT 1 AS ok"
    ).catch((e: Error) => `❌ pool: ${e.message}`),
  ]);

  let poolQuery = "not attempted";
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    poolQuery = `ok: ${JSON.stringify(rows)}`;
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    poolQuery = `${err.code ?? "ERR"} — ${err.message?.slice(0, 180)}`;
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-10 font-mono text-sm">
      <h1 className="text-xl">Deployment diagnostics</h1>
      <section>
        <h2 className="mb-2 text-xs uppercase tracking-widest text-gray-500">env vars</h2>
        <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4 text-xs leading-relaxed">
{Object.entries(env)
  .map(([k, v]) => `${k} = ${k === "DB_PASSWORD" || k === "JWT_SECRET" ? mask(v ?? undefined) : v ?? "MISSING"}`)
  .join("\n")}
        </pre>
      </section>
      <section>
        <h2 className="mb-2 text-xs uppercase tracking-widest text-gray-500">connection attempts</h2>
        <pre className="whitespace-pre-wrap rounded bg-gray-50 p-4 text-xs leading-relaxed">
          {results.join("\n")}
          {"\n"}app pool.query(&apos;SELECT 1&apos;): {poolQuery}
          {"\n"}node: {process.version} · region env: {process.env.VERCEL_REGION ?? "local"}
        </pre>
      </section>
      <p className="text-xs text-gray-400">
        Remove src/app/debug after setup.
      </p>
    </main>
  );
}
