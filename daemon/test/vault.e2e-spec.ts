/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApp } from './helpers/test-app';

describe('Vault API', () => {
  let app: INestApplication<App>;
  let resetDb: () => Promise<void>;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    ({ app, resetDb, cleanup } = await createE2eApp());
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('happy cases', () => {
    // create, list, get, update, delete

    it('should create a vault', async () => {
      const payload = {
        name: 'work',
        localPath: '/home/user/vaults/work',
        remote: 'git@github.com:you/work.git',
      };

      const createRes = await request(app.getHttpServer())
        .post('/vaults')
        .send(payload)
        .expect(201);

      expect(createRes.body).toEqual(
        expect.objectContaining({
          ...payload,
          id: expect.any(String),
          branch: 'main',
          autoSync: false,
          syncInterval: 300,
          conflictStrategy: 'log-and-skip',
          isDirty: false,
        }),
      );

      await request(app.getHttpServer())
        .get(`/vaults/${createRes.body.id}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createRes.body.id);
        });
    });

    it('list vaults', async () => {
      await request(app.getHttpServer())
        .get('/vaults')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('updates a vault', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/vaults')
        .send({
          name: 'docs',
          localPath: '/tmp/docs',
          remote: 'git@github.com:acme/docs.git',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/vaults/${body.id}`)
        .send({ branch: 'develop', autoSync: true })
        .expect(200)
        .expect((res) => {
          expect(res.body.branch).toBe('develop');
          expect(res.body.autoSync).toBe(true);
        });
    });

    it('deletes a vault', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/vaults')
        .send({
          name: 'temp',
          localPath: '/tmp/temp',
          remote: 'git@github.com:acme/temp.git',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/vaults/${body.id}`)
        .expect(200);

      await request(app.getHttpServer()).get(`/vaults/${body.id}`).expect(404);
    });
  });

  describe('validation', () => {
    // malformed body, invalid enum, missing required fields

    it('should return 400 for invalid vault creation payload', async () => {
      await request(app.getHttpServer())
        .post('/vaults')
        .send({ name: 'invalid' }) // Missing required fields
        .expect(400);
    });

    it('should return 404 for invalid vault update id', async () => {
      await request(app.getHttpServer())
        .patch('/vaults/invalid-id')
        .send({ branch: 'develop' })
        .expect(404);
    });
  });

  // describe('domain errors', () => {
  // not found, duplicate name, duplicate localPath, etc.
  // });
});
