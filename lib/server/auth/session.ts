import type { User, Session } from "@/lib/server/db/schema"
import { userTable, sessionTable } from "@/lib/server/db/schema"
import { db } from "@/lib/server/db"
import { eq } from "drizzle-orm"
import {
  encodeBase32LowerCaseNoPadding,
  encodeHexLowerCase,
} from "@oslojs/encoding"
import { sha256 } from "@oslojs/crypto/sha2"
import { cookies } from "next/headers"
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache"

/**
 * Generates a random session token.
 * @returns {string} A base32 encoded random token.
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(20)
  crypto.getRandomValues(bytes)
  const token = encodeBase32LowerCaseNoPadding(bytes)
  return token
}

/**
 * Creates a new session for a user.
 * @param {string} token - The session token.
 * @param {number} userId - The ID of the user.
 * @returns {Promise<Session>} A promise that resolves to the created session.
 */
export async function createSession(
  token: string,
  userId: number
): Promise<Session> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))
  const session: Session = {
    id: sessionId,
    userId,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
  }
  await db.insert(sessionTable).values(session)
  return session
}

/**
 * Validates a session token.
 * @param {string} token - The session token to validate.
 * @returns {Promise<SessionValidationResult>} A promise that resolves to the validation result.
 */
export async function validateSessionToken(
  token: string
): Promise<SessionValidationResult> {
  const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)))
  const result = await db
    .select({ user: userTable, session: sessionTable })
    .from(sessionTable)
    .innerJoin(userTable, eq(sessionTable.userId, userTable.id))
    .where(eq(sessionTable.id, sessionId))
  if (result.length < 1) {
    return { session: null, user: null }
  }
  const { user, session } = result[0]
  if (Date.now() >= session.expiresAt.getTime()) {
    await db.delete(sessionTable).where(eq(sessionTable.id, session.id))
    return { session: null, user: null }
  }
  if (Date.now() >= session.expiresAt.getTime() - 1000 * 60 * 60 * 24 * 15) {
    session.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    await db
      .update(sessionTable)
      .set({
        expiresAt: session.expiresAt,
      })
      .where(eq(sessionTable.id, session.id))
  }
  return { session, user }
}

/**
 * Invalidates a specific session.
 * @param {string} sessionId - The ID of the session to invalidate.
 * @returns {Promise<void>} A promise that resolves when the session is invalidated.
 */
export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessionTable).where(eq(sessionTable.id, sessionId))
}

/**
 * Invalidates all sessions for a user.
 * @param {number} userId - The ID of the user whose sessions should be invalidated.
 * @returns {Promise<void>} A promise that resolves when all sessions are invalidated.
 */
export async function invalidateAllSessions(userId: number): Promise<void> {
  await db.delete(sessionTable).where(eq(sessionTable.userId, userId))
}

/**
 * Sets a session token cookie.
 * @param {string} token - The session token to set in the cookie.
 * @param {Date} expiresAt - The expiration date for the cookie.
 * @returns {Promise<void>} A promise that resolves when the cookie is set.
 */
export async function setSessionTokenCookie(
  token: string,
  expiresAt: Date
): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  })
}

/**
 * Deletes the session token cookie.
 * @returns {Promise<void>} A promise that resolves when the cookie is deleted.
 */
export async function deleteSessionTokenCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set("session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  })
}

/**
 * Retrieves the current session.
 * @returns {Promise<SessionValidationResult>} A promise that resolves to the current session.
 */
export async function getCurrentSession() {
  const cookieStore = await cookies()
  return getCurrentSessionCached(cookieStore.get("session")?.value ?? null)
}

/**
 * Retrieves the current session from the cache.
 * @param {ReadonlyRequestCookies} cookieStore - The cookie store to use.
 * @returns {Promise<SessionValidationResult>} A promise that resolves to the current session.
 */
export const getCurrentSessionCached = async (
  token: string | null
): Promise<SessionValidationResult> => {
  "use cache"

  if (token === null) {
    return { session: null, user: null }
  }
  const result = await validateSessionToken(token)

  if (!result.session) {
    return { session: null, user: null }
  }

  cacheTag(`session:${result.session.id}`)

  const now = Date.now()
  const expiresAt = result.session.expiresAt.getTime()
  const remainingTime = Math.max(0, Math.floor((expiresAt - now) / 1000))

  cacheLife({
    stale: 0,
    revalidate: remainingTime,
    expire: remainingTime,
  })

  return result
}

export type SessionValidationResult =
  | { session: Session; user: User }
  | { session: null; user: null }
