import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const vaults = sqliteTable('vaults', {
  id: text('id').primaryKey(),
});
