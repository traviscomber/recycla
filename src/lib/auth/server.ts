import "server-only";

import { createHash } from "node:crypto";
import { createNeonAuth } from "@neondatabase/auth/next/server";

export type RecyclaRole = "viewer" | "operator" | "compliance" | "admin";

const writeRoles = new Set<RecyclaRole>(["operator", "compliance", "admin"]);
const complianceRoles = new Set<RecyclaRole>(["compliance", "admin"]);

const DEFAULT_NEON_AUTH_BASE_URL =
  "https://ep-raspy-truth-aueadgwt.neonauth.c-10.us-east-1.aws.neon.tech/neondb/auth";

function resolveCookieSecret() {
  const explicit = process.env.NEON_AUTH_COOKIE_SECRET;
  if (explicit && explicit.length >= 32) return explicit;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  return createHash("sha256")
    .update("recycla-neon-auth-cookie-v1\0")
    .update(databaseUrl)
    .digest("base64url");
}

export function isAuthConfigured() {
  return Boolean(
    (process.env.NEON_AUTH_BASE_URL || DEFAULT_NEON_AUTH_BASE_URL) &&
      resolveCookieSecret()
  );
}

function createAuth() {
  const secret = resolveCookieSecret();

  if (!secret) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  return createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL || DEFAULT_NEON_AUTH_BASE_URL,
    cookies: {
      secret
    }
  });
}

function normalizeRoles(value: unknown): RecyclaRole[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return raw
    .map((role) => String(role).trim().toLowerCase())
    .filter((role): role is RecyclaRole =>
      role === "viewer" ||
      role === "operator" ||
      role === "compliance" ||
      role === "admin"
    );
}

export function getAuthServer() {
  return createAuth();
}

export async function getRecyclaSession() {
  if (!isAuthConfigured()) {
    return { configured: false as const, session: null, roles: [] as RecyclaRole[] };
  }

  const auth = createAuth();
  const { data, error } = await auth.getSession();

  if (error || !data?.user) {
    return { configured: true as const, session: null, roles: [] as RecyclaRole[] };
  }

  return {
    configured: true as const,
    session: data,
    roles: normalizeRoles((data.user as { role?: unknown }).role)
  };
}

export async function requireWriteSession() {
  const state = await getRecyclaSession();

  if (!state.configured) throw new Error("AUTH_NOT_CONFIGURED");
  if (!state.session?.user) throw new Error("AUTH_REQUIRED");
  if (!state.roles.some((role) => writeRoles.has(role))) throw new Error("AUTH_FORBIDDEN");

  return state;
}

export async function requireComplianceSession() {
  const state = await getRecyclaSession();

  if (!state.configured) throw new Error("AUTH_NOT_CONFIGURED");
  if (!state.session?.user) throw new Error("AUTH_REQUIRED");
  if (!state.roles.some((role) => complianceRoles.has(role))) throw new Error("AUTH_FORBIDDEN");

  return state;
}
