import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { Database } from '@/database/database';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { clearTestData, createTestDbFile, removeTestDbFile } from './test-db';

export async function createE2eApp(): Promise<{
  app: INestApplication;
  resetDb: () => Promise<void>;
  cleanup: () => Promise<void>;
}> {
  const dbFile = createTestDbFile();
  process.env.DB_FILE_NAME = `file:${dbFile.filename}`;

  const module: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = module.createNestApplication();
  const db = module.get(Database);

  await db.configure();
  migrate(db.db, { migrationsFolder: 'drizzle' });
  await app.init();

  return {
    app,
    resetDb: async () => await clearTestData(db),
    cleanup: async () => {
      await app.close();
      removeTestDbFile(dbFile.filename);
    },
  };
}
