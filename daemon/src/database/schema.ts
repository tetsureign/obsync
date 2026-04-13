import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

// TODO: extract to a separate .helper file if this gets too big
const timestamps = {
  updatedAt: t.integer({ mode: 'timestamp' }),
  createdAt: t.integer({ mode: 'timestamp' }).notNull(),
};

export const vaults = sqliteTable('vaults', {
  id: t.text().primaryKey(),
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
  conflictStrategy: t.text().notNull().default('log-and-skip'),
  lastSyncedAt: t.integer({ mode: 'timestamp' }),
  ...timestamps,
});
