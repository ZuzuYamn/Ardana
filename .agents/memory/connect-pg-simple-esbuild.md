---
name: connect-pg-simple esbuild bundling issue
description: connect-pg-simple reads a table.sql file at runtime that esbuild does not copy to dist/; createTableIfMissing always fails in bundled builds
---

## Rule
Never use `createTableIfMissing: true` with connect-pg-simple when the API server is bundled by esbuild.

**Why:** connect-pg-simple's `createTableIfMissing` implementation reads a `table.sql` file from its own package directory at runtime. When esbuild bundles the app, it inlines the JS but does not copy the `.sql` file to the dist folder, so the file read fails with `ENOENT` on every session write — causing a 500 on login.

**How to apply:** Create the `user_sessions` table once manually via psql (or a migration), and omit `createTableIfMissing` from the PgStore constructor. Schema:

```sql
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
) WITH (OIDS=FALSE);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
```
