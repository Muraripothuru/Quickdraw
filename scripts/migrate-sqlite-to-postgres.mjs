import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient: PostgresClient } = require("@prisma/client");
const { PrismaClient: SqliteClient } = require("../prisma/generated/sqlite");

const sqliteUrl = process.env.SQLITE_DATABASE_URL;
const postgresUrl = process.env.DATABASE_URL;

if (!sqliteUrl || !postgresUrl) {
  throw new Error("Set SQLITE_DATABASE_URL and DATABASE_URL before running the migration.");
}

const sqlite = new SqliteClient({ datasources: { db: { url: sqliteUrl } } });
const postgres = new PostgresClient({ datasources: { db: { url: postgresUrl } } });
const modelNames = ["user", "session", "savedRoster", "draw", "participant", "winner"];

try {
  await sqlite.$connect();
  await postgres.$connect();

  const counts = {};
  for (const modelName of modelNames) {
    counts[modelName] = await sqlite[modelName].count();
  }

  const destinationCounts = await Promise.all(
    modelNames.map((modelName) => postgres[modelName].count()),
  );
  if (destinationCounts.some((count) => count !== 0)) {
    throw new Error("The PostgreSQL destination is not empty; refusing to merge or overwrite data.");
  }

  const records = {};
  for (const modelName of modelNames) {
    records[modelName] = await sqlite[modelName].findMany();
  }

  await postgres.$transaction(
    async (transaction) => {
      for (const modelName of modelNames) {
        const rows = records[modelName];
        for (let offset = 0; offset < rows.length; offset += 500) {
          await transaction[modelName].createMany({
            data: rows.slice(offset, offset + 500),
          });
        }
      }
    },
    { maxWait: 10_000, timeout: 600_000 },
  );

  console.log(
    `Transferred records: ${modelNames.map((modelName) => `${modelName}=${counts[modelName]}`).join(", ")}`,
  );
} finally {
  await Promise.all([sqlite.$disconnect(), postgres.$disconnect()]);
}
