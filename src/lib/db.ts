import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST ?? "localhost",
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME ?? "hospital_db",
  waitForConnections: true,
  connectionLimit: 10,
  // Moonshot for cloud MySQL (TiDB/PlanetScale/Aiven) — enable with DB_SSL=true
  ssl:
    process.env.DB_SSL === "true"
      ? { minVersion: "TLSv1.2", rejectUnauthorized: true }
      : undefined,
  // Return DATE/DATETIME/TIMESTAMP as 'YYYY-MM-DD' strings instead of JS Dates.
  // TIME columns already come back as strings by default.
  dateStrings: ["DATE", "TIMESTAMP", "DATETIME"],
  supportBigNumbers: true,
});

/** Runs a function on a dedicated connection from the pool (use with transactions). */
export async function withConn<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}
