import { defineConfig } from 'drizzle-kit';

// Schema reference for drizzle-kit tooling (introspection/diff). Migrations are hand-written SQL in ./drizzle
// and applied by src/shared/db/migrate.ts with the owner role, so RLS policies and grants live next to the DDL.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/features/**/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL_OWNER ?? '' },
});
