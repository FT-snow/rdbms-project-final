import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pool } from "./db";

export type Role = "admin" | "doctor" | "receptionist";

export type Session = {
  userId: number;
  username: string;
  role: Role;
  doctorId?: number | null;
};

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-change-me-please-32chars!"
);
const COOKIE = "session";

/** Verify username + password against users table; returns Session or null. */
export async function login(username: string, password: string): Promise<Session | null> {
  const [rows] = await pool.execute(
    "SELECT user_id, username, password_hash, role, doctor_id FROM users WHERE username = ?",
    [username]
  );
  const u = (rows as any[])[0];
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return null;
  return { userId: u.user_id, username: u.username, role: u.role, doctorId: u.doctor_id ?? null };
}

export async function createSessionCookie(session: Session) {
  const token = await new SignJWT(JSON.parse(JSON.stringify(session)))
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .sign(secret);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 12,
    path: "/",
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
