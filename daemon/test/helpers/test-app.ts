import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { rmSync } from 'fs';
import type { Server } from 'http';
import { AppModule } from '@/app.module';
import { AppService } from '@/app.service';
import { Database } from '@/database/database';
import { clearTestData, createTestDbFile, removeTestDbFile } from './test-db';
import { testDataDir } from './test-env';

function buildAuthedRequest(app: INestApplication, token: string) {
  const server = request(app.getHttpServer() as Server);
  const bearer = `Bearer ${token}`;

  return () => ({
    get: (url: string) => server.get(url).set('Authorization', bearer),
    post: (url: string) => server.post(url).set('Authorization', bearer),
    patch: (url: string) => server.patch(url).set('Authorization', bearer),
    put: (url: string) => server.put(url).set('Authorization', bearer),
    delete: (url: string) => server.delete(url).set('Authorization', bearer),
  });
}

export type AuthedRequest = ReturnType<typeof buildAuthedRequest>;

export async function createE2eApp(): Promise<{
  app: INestApplication;
  db: Database;
  authedRequest: AuthedRequest;
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

  const authedRequest = buildAuthedRequest(
    app,
    module.get(AppService).authToken,
  );

  return {
    app,
    db,
    authedRequest,
    resetDb: async () => await clearTestData(db),
    cleanup: async () => {
      await app.close();
      removeTestDbFile(dbFile.filename);
      rmSync(testDataDir, { recursive: true, force: true });
    },
  };
}
