/**
 * Node-runtime auth: password hashing plus the server-side session helpers used
 * by server components and server actions.
 *
 * Accounts live in the `users` table. Everyone who signs up shares the same
 * business data — this is several logins for one company, not multi-tenancy.
 * Signup is gated by SIGNUP_CODE so strangers can't register themselves.
 */
import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  createSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

export const MIN_PASSWORD_LENGTH = 10;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // Colon-separated (not "$"): dotenv would try to expand a $-prefixed segment.
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== KEY_LENGTH) return false;
  const derived = await scrypt(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return timingSafeEqual(derived, expected);
}

/** A throwaway hash, compared against when no such user exists, to keep the
 *  response time for "unknown email" close to that for "wrong password". */
const DUMMY_HASH =
  "scrypt:00000000000000000000000000000000:" + "0".repeat(KEY_LENGTH * 2);

export async function authenticate(email: string, password: string): Promise<User | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normaliseEmail(email)))
    .limit(1);

  const matches = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) return null;

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  return user;
}

export type SignupResult = { user: User } | { error: string };

export async function createUser(
  email: string,
  password: string,
  signupCode: string,
): Promise<SignupResult> {
  const expectedCode = process.env.SIGNUP_CODE;
  if (!expectedCode) {
    return { error: "Signup isn't configured. Set SIGNUP_CODE to allow new accounts." };
  }
  if (signupCode.trim() !== expectedCode) {
    return { error: "That signup code isn't right." };
  }

  const normalised = normaliseEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
    return { error: "Enter a valid email address." };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, normalised))
    .limit(1);
  if (existing) return { error: "There's already an account with that email." };

  try {
    const [user] = await db
      .insert(users)
      .values({ email: normalised, passwordHash: await hashPassword(password) })
      .returning();
    return { user };
  } catch (error) {
    // Unique constraint — someone registered the same email in the meantime.
    if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
      return { error: "There's already an account with that email." };
    }
    throw error;
  }
}

export async function countUsers(): Promise<number> {
  const rows = await db.select({ id: users.id }).from(users);
  return rows.length;
}

export async function startSession(user: { id: number; email: string }): Promise<void> {
  const token = await createSessionToken({ userId: user.id, email: user.email });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/**
 * Guard for every server component, server action and route handler that touches
 * business data. The middleware redirect is a convenience; this is the real check.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
