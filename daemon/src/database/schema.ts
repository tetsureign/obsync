import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

// const timestamps = {
//   updatedAt: t.integer({ mode: 'timestamp' }),
//   createdAt: t
//     .integer({ mode: 'timestamp' })
//     .notNull()
//     .default(Temporal.now().toMillis()),
// };

export const vaults = sqliteTable('vaults', {
  id: t.text().primaryKey(),
  name: t.text().notNull(),
  localPath: t.text().notNull().unique(),
  remote: t.text().notNull(),
  branch: t.text().notNull().default('main'),
  autoSync: t.integer({ mode: 'boolean' }).notNull().default(false),
});
