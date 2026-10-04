import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: databaseUrl.includes("railway.internal") ? false : "require",
});

await sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

const migrationsDirectory = path.join(process.cwd(), "db", "migrations");
const filenames = (await fs.readdir(migrationsDirectory))
  .filter((filename) => filename.endsWith(".sql"))
  .sort();

for (const filename of filenames) {
  const [existing] = await sql`
    SELECT filename
    FROM schema_migrations
    WHERE filename = ${filename}
  `;

  if (existing) {
    console.log(`skip ${filename}`);
    continue;
  }

  const contents = await fs.readFile(path.join(migrationsDirectory, filename), "utf8");

  await sql.begin(async (tx) => {
    await tx.unsafe(contents);
    await tx`INSERT INTO schema_migrations (filename) VALUES (${filename})`;
  });

  console.log(`applied ${filename}`);
}

await sql.end();
