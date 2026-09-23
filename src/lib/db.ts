import "server-only";
import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");

  if (!client) {
    client = postgres(url, {
      prepare: false,
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10
    });
  }

  return client;
}
