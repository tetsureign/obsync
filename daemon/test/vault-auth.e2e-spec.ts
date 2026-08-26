/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import request from 'supertest';
import { createE2eApp } from './helpers/test-app';

describe('Vault API authorization', () => {
  let app: INestApplication;
  let cleanup: () => Promise<void>;

  const httpServer = () => request(app.getHttpServer() as Server);

  beforeAll(async () => {
    ({ app, cleanup } = await createE2eApp());
  });

  afterAll(async () => {
    await cleanup();
  });

  it('rejects requests without an authorization header', async () => {
    await httpServer().get('/vaults').expect(401);
  });

  it('rejects requests with an invalid token', async () => {
    await httpServer()
      .get('/vaults')
      .set('Authorization', 'Bearer not-the-real-token')
      .expect(401)
      .expect((res) => {
        expect(res.body.statusCode).toBe(401);
      });
  });
});
