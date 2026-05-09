import { sql } from 'drizzle-orm';
import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

// TODO: extract to a separate .helper file if this gets too big
const timestamps = {
  updatedAt: t
    .integer({ mode: 'timestamp' })
    .$onUpdate(() => sql<number>`(unixepoch())`),
  createdAt: t
    .integer({ mode: 'timestamp' })
    .notNull()
    .default(sql<number>`(unixepoch())`),
};

export const vaults = sqliteTable('vaults', {
  id: t
    .text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: t.text().notNull().unique(), // Unique because the cli might be confused by multiple vaults with the same name
  localPath: t.text().notNull().unique(),
  remote: t.text().notNull(),
  branch: t.text().notNull().default('main'),
  isDirty: t.integer({ mode: 'boolean' }).notNull().default(false),
  autoSync: t.integer({ mode: 'boolean' }).notNull().default(false),
  syncInterval: t
    .integer()
    .notNull()
    .default(5 * 60), // in seconds
  conflictStrategy: t
    .text({ enum: ['log-and-skip', 'stash-and-retry'] })
    .notNull()
    .default('log-and-skip'), // 'log-and-skip' | 'stash-and-retry'
  lastSyncedAt: t.integer({ mode: 'timestamp' }),
  ...timestamps,
});

export const syncOperations = sqliteTable(
  'sync_operations',
  {
    id: t
      .text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    vaultId: t
      .text()
      .notNull()
      .references(() => vaults.id, { onDelete: 'cascade' }),
    status: t
      .text({ enum: ['queued', 'running', 'success', 'failed', 'aborted'] })
      .notNull(),
    step: t
      .text({ enum: ['pull', 'stage', 'commit', 'push', 'done'] })
      .notNull(),
    error: t.text(),
    commitSha: t.text(), // nullable — null if nothing was committed (already up to date)
    startedAt: t
      .integer({ mode: 'timestamp' })
      .notNull()
      .default(sql<number>`(unixepoch())`),
    ...timestamps,
  },
  (table) => [
    t
      .uniqueIndex('sync_operations_one_active_per_vault')
      .on(table.vaultId)
      .where(sql`${table.status} IN ('queued', 'running')`),
  ],
);

export const conflictRecords = sqliteTable('conflict_records', {
  id: t
    .text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  vaultId: t
    .text()
    .notNull()
    .references(() => vaults.id, { onDelete: 'cascade' }),
  files: t.text().notNull(), // JSON array of file paths that are in conflict
  strategy: t.text({ enum: ['log-and-skip', 'stash-and-retry'] }).notNull(),
  resolved: t.integer({ mode: 'boolean' }).notNull().default(false),
  ...timestamps,
});
