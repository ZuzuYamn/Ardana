import { pgTable, varchar, json, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Express session store table used by connect-pg-simple.
 * NOTE: This table must be created manually via SQL (never use createTableIfMissing).
 * The connect-pg-simple table.sql file is not bundled by esbuild.
 */
export const userSessionsTable = pgTable(
  "user_sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire", { precision: 6 }).notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);
