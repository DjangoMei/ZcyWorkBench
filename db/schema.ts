import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const remoteState = sqliteTable("remote_state", {
  id: text("id").primaryKey(),
  payload: text("payload").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const remoteBackups = sqliteTable(
  "remote_backups",
  {
    id: text("id").primaryKey(),
    payload: text("payload").notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [index("idx_remote_backups_expires_at").on(table.expiresAt)],
);
