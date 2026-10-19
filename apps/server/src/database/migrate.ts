import * as path from 'path';
import { promises as fs } from 'fs';
import { Kysely, Migrator, FileMigrationProvider } from 'kysely';
import { run } from 'kysely-migration-cli';
import * as dotenv from 'dotenv';
import { envPath, normalizePostgresUrl } from '../common/helpers';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

dotenv.config({ path: envPath });

const migrationFolder = path.join(__dirname, './migrations');

const db = new Kysely<any>({
  dialect: new PostgresJSDialect({
    postgres: postgres(normalizePostgresUrl(process.env.DATABASE_URL)),
  }),
});

const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder,
  }),
  // Gevekom: our fork migration 20260701T120000-webhooks already ran in prod,
  // while upstream later added migrations with older timestamps (e.g.
  // 20260529-bases, 20260620-personal-spaces). Without this flag Kysely aborts
  // with "corrupted migrations" instead of running the pending older ones.
  allowUnorderedMigrations: true,
});

run(db, migrator, migrationFolder);
