/**
 * Runs sql/schema.sql against a MySQL-compatible host (works with TiDB Cloud).
 *
 *   bun run scripts/run-schema.ts <host> <port> <user> <password> [database]
 *
 * Handles DELIMITER blocks ($$-terminated routine bodies) that web consoles
 * and plain statement-splitters cannot, continues past statements the host
 * doesn't support (logged), and prints a final object inventory.
 */
import fs from "node:fs";
import mysql from "mysql2/promise";

const [host, port, user, password, database = "hospital_db"] =
  process.argv.slice(2);

if (!host || !port || !user || !password) {
  console.error("usage: bun run scripts/run-schema.ts <host> <port> <user> <password> [database]");
  process.exit(1);
}

// --- split schema.sql into executable statements ---------------------------

function parseStatements(sql: string): string[] {
  const stmts: string[] = [];
  let buffer = "";
  let delimiter = ";";
  const lines = sql.split("\n");

  for (const line of lines) {
    const delimDirective = line.match(/^\s*DELIMITER\s+(\S+)/i);
    if (delimDirective) {
      if (buffer.trim()) stmts.push(buffer.trim());
      buffer = "";
      delimiter = delimDirective[1];
      continue;
    }
    buffer += line + "\n";
    // statement end: line ends with current delimiter
    if (delimiter === ";" && line.trimEnd().endsWith(";")) {
      if (buffer.trim()) stmts.push(buffer.trim());
      buffer = "";
    } else if (delimiter !== ";" && line.trimEnd().endsWith(delimiter)) {
      if (buffer.trim()) stmts.push(buffer.trim().slice(0, -delimiter.length));
      buffer = "";
      delimiter = ";";
    }
  }
  if (buffer.trim()) stmts.push(buffer.trim());
  return stmts;
}

// --- run --------------------------------------------------------------------

const sql = fs.readFileSync(new URL("../sql/schema.sql", import.meta.url), "utf8");
const statements = parseStatements(sql).map((s) =>
  // substitute the target database name for hospital_db everywhere
  s.replace(/\bhospital_db\b/g, database)
);

const conn = await mysql.createConnection({
  host,
  port: Number(port),
  user,
  password,
  ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
  multipleStatements: false,
});

let ok = 0;
let failed = 0;
const errors: string[] = [];

for (const [i, stmt] of statements.entries()) {
  const label = stmt.replace(/\s+/g, " ").slice(0, 64);
  try {
    await conn.query(stmt);
    ok++;
  } catch (e: any) {
    failed++;
    const msg = `[${i + 1}] ${label}… → ${e.code ?? ""} ${e.message?.slice(0, 140)}`;
    // USE statements may fail if the DB name differs; CREATE on serverless
    // can be restricted — record and continue so we get the full picture.
    errors.push(msg);
    console.error("FAIL", msg);
  }
}

console.log(`\n${ok} statements ok, ${failed} failed.`);

// --- inventory --------------------------------------------------------------

try {
  await conn.query(`USE \`${database}\``);
  const [tables] = await conn.query(`SHOW TABLES`);
  const [trigs] = await conn.query(`SHOW TRIGGERS`);
  const [procs] = await conn.query(
    `SELECT ROUTINE_NAME, ROUTINE_TYPE FROM information_schema.ROUTINES
      WHERE ROUTINE_SCHEMA = ?`, [database]
  );
  const [views] = await conn.query(
    `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?`, [database]
  );
  console.log("tables:", JSON.stringify((tables as any[]).map((r) => Object.values(r)[0])));
  console.log("triggers:", JSON.stringify((trigs as any[]).map((r) => r.Trigger)));
  console.log("routines:", JSON.stringify((procs as any[]).map((r) => r.ROUTINE_NAME)));
  console.log("views:", JSON.stringify((views as any[]).map((r) => r.TABLE_NAME)));
  console.log(`\n${database} ready.`);
} catch (e: any) {
  console.error("inventory check failed:", e.message);
}

await conn.end();
