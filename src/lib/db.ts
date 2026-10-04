import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;

export function db() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!client) {
    client = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: databaseUrl.includes("railway.internal") ? false : "require",
    });
  }

  return client;
}
