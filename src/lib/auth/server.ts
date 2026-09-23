import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

export type RecyclaRole = "viewer" | "operator" | "compliance" | "admin";

const writeRoles = new Set<RecyclaRole>(["operator", "compliance", "admin"]);
const complianceRoles = new Set<RecyclaRole>(["compliance", "admin"]);

export function isAuthConfigured() {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL &&
    process.env.NEON_AUTH_COOKIE_SECRET &&
    process.env.NEON_AUTH_COOKIE_SECRET.length >= 32
  );
}

function authInstance() {
  if (!isAuthConfigured()) {
    throw new Error("AUTH_NOT_CONFIGURED");
  }

  return createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: {
      secret: process.env.NEON_AUTH_COOKIE_SECRET!
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

export async function getRecyclaSession() {
  if (!isAuthConfigured()) {
    return { configured: false as const, session: null, roles: [] as RecyclaRole[] };
  }

  const auth = authInstance();
  const { data, error } = await auth.getSession();

  if (error || !data?.user) {
    return { configured: true as const, session: null, roles: [] as RecyclaRole[] };
  }

  const roles = normalizeRoles((data.user as { role?: unknown }).role);

  return {
    configured: true as const,
    session: data,
    roles
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
