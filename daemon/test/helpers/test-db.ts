import { randomUUID } from 'crypto';
import { existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { type Database } from '@/database/database';
import { conflictRecords, syncRecords, vaults } from '@/database/schema';

export function createTestDbFile() {
  const filename = join(tmpdir(), `obsync-e2e-${randomUUID()}.db`);
  return {
    filename,
    url: `file:${filename}`,
  };
}

export async function clearTestData(database: Database) {
  await database.db.delete(conflictRecords);
  await database.db.delete(syncRecords);
  await database.db.delete(vaults);
}

export function removeTestDbFile(dbFile: string) {
  if (existsSync(dbFile)) {
    rmSync(dbFile, { force: true });
  }
}
