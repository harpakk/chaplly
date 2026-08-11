import fs from "node:fs/promises";
import path from "node:path";
import {
  connectPostgres,
  retryableConnectionError,
} from "./postgres-client.mjs";

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL is required in .envsecure");

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));
const directory = path.resolve("supabase/migrations");
const files = (await fs.readdir(directory))
  .filter((name) => name.endsWith(".sql"))
  .sort();

async function loadAppliedMigrations() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const client = await connectPostgres();
    try {
      await client.query(
        "create table if not exists public._chapli_migrations(name text primary key, applied_at timestamptz not null default now())",
      );
      const result = await client.query(
        "select name from public._chapli_migrations",
      );
      return new Set(result.rows.map((row) => row.name));
    } catch (error) {
      if (!retryableConnectionError(error) || attempt === 2) throw error;
      await wait(750 * (attempt + 1));
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  throw new Error("Could not read migration state");
}

const appliedMigrations = await loadAppliedMigrations();
const pendingFiles = files.filter((name) => !appliedMigrations.has(name));

for (const name of pendingFiles) {
  const sql = await fs.readFile(path.join(directory, name), "utf8");
  let applied = false;
  for (let attempt = 0; attempt < 3 && !applied; attempt += 1) {
    const client = await connectPostgres();
    try {
      const alreadyApplied = await client.query(
        "select 1 from public._chapli_migrations where name=$1",
        [name],
      );
      if (alreadyApplied.rowCount) {
        applied = true;
        continue;
      }
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into public._chapli_migrations(name) values($1)",
          [name],
        );
        await client.query("commit");
        console.log(`applied=${name}`);
        applied = true;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    } catch (error) {
      if (!retryableConnectionError(error) || attempt === 2) throw error;
      console.warn(`retry=${name} attempt=${attempt + 2}`);
      await wait(750 * (attempt + 1));
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
