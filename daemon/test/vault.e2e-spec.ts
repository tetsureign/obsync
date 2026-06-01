/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createE2eApp } from './helpers/test-app';

// TODO: More test cases regarding sync behaviors. Maybe I should split this to several files
describe('Vault API', () => {
  const nonexistentVaultId = '00000000-0000-4000-8000-000000000000';

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

    it('rejects missing required fields on create', async () => {
      await request(app.getHttpServer())
        .post('/vaults')
        .send({ name: 'invalid' }) // Missing required fields
        .expect(400);
    });

    it('rejects invalid conflictStrategy values', async () => {
      await request(app.getHttpServer())
        .post('/vaults')
        .send({
          name: 'invalid',
          localPath: '/tmp/invalid',
          remote: 'git@github.com:acme/invalid.git',
          conflictStrategy: 'invalid-value', // Invalid enum value
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              statusCode: 400,
            }),
          );
        });
    });

    it('rejects invalid primitive types on create', async () => {
      await request(app.getHttpServer())
        .post('/vaults')
        .send({
          name: 'invalid',
          localPath: '/tmp/invalid',
          remote: 'git@github.com:acme/invalid.git',
          branch: 123, // Invalid type
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              statusCode: 400,
            }),
          );
        });
    });

    it('rejects invalid primitive types on update', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/vaults')
        .send({
          name: 'test',
          localPath: '/tmp/test',
          remote: 'git@github.com:acme/test.git',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/vaults/${body.id}`)
        .send({ branch: 123 }) // Invalid type
        .expect(400)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              statusCode: 400,
            }),
          );
        });
    });

    it('accepts partial payloads on update', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/vaults')
        .send({
          name: 'partial-update',
          localPath: '/tmp/partial',
          remote: 'git@github.com:acme/partial.git',
        })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/vaults/${body.id}`)
        .send({ branch: 'develop' })
        .expect(200);
    });
  });

  describe('domain errors', () => {
    // not found, duplicate name, duplicate localPath, etc.

    it('rejects duplicate vault name creation', async () => {
      const payload = {
        name: 'duplicate',
        localPath: '/tmp/duplicate',
        remote: 'git@github.com:acme/duplicate.git',
      };

      const payload2 = {
        name: 'duplicate',
        localPath: '/tmp/not-uplicate',
        remote: 'git@github.com:acme/not-duplicate.git',
      };

      await request(app.getHttpServer())
        .post('/vaults')
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .post('/vaults')
        .send(payload2)
        .expect(409)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              statusCode: 409,
            }),
          );
        });
    });

    it('rejects duplicate vault name update', async () => {
      const payload1 = {
        name: 'whatever',
        localPath: '/tmp/whatever',
        remote: 'git@github.com:acme/whatever.git',
      };

      const payload2 = {
        name: 'duplicate',
        localPath: '/tmp/duplicate',
        remote: 'git@github.com:acme/duplicate.git',
      };

      const { body: bodyPayload1 } = await request(app.getHttpServer())
        .post('/vaults')
        .send(payload1)
        .expect(201);

      await request(app.getHttpServer())
        .post('/vaults')
        .send(payload2)
        .expect(201);

      // Uses payload2's name to update payload1's record
      await request(app.getHttpServer())
        .patch(`/vaults/${bodyPayload1.id}`)
        .send({ name: payload2.name })
        .expect(409)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              statusCode: 409,
            }),
          );
        });
    });

    it('rejects duplicate localPath creation', async () => {
      const payload1 = {
        name: 'whatever',
        localPath: '/tmp/whatever',
        remote: 'git@github.com:acme/whatever.git',
      };

      const payload2 = {
        name: 'duplicate',
        localPath: '/tmp/whatever',
        remote: 'git@github.com:acme/duplicate.git',
      };

      await request(app.getHttpServer())
        .post('/vaults')
        .send(payload1)
        .expect(201);

      await request(app.getHttpServer())
        .post('/vaults')
        .send(payload2)
        .expect(409)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              statusCode: 409,
            }),
          );
        });
    });

    it('rejects duplicate localPath update', async () => {
      const payload1 = {
        name: 'whatever',
        localPath: '/tmp/whatever',
        remote: 'git@github.com:acme/whatever.git',
      };

      const payload2 = {
        name: 'duplicate',
        localPath: '/tmp/duplicate',
        remote: 'git@github.com:acme/duplicate.git',
      };

      const { body: bodyPayload1 } = await request(app.getHttpServer())
        .post('/vaults')
        .send(payload1)
        .expect(201);

      await request(app.getHttpServer())
        .post('/vaults')
        .send(payload2)
        .expect(201);

      // Uses payload2's name to update payload1's record
      await request(app.getHttpServer())
        .patch(`/vaults/${bodyPayload1.id}`)
        .send({ localPath: payload2.localPath })
        .expect(409)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              statusCode: 409,
            }),
          );
        });
    });

    it('rejects nonexistent vault update id', async () => {
      await request(app.getHttpServer())
        .patch(`/vaults/${nonexistentVaultId}`)
        .send({ branch: 'develop' })
        .expect(404)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              statusCode: 404,
            }),
          );
        });
    });

    it('rejects nonexistent vault delete id', async () => {
      await request(app.getHttpServer())
        .delete(`/vaults/${nonexistentVaultId}`)
        .expect(404)
        .expect((res) => {
          expect(res.body).toEqual(
            expect.objectContaining({
              statusCode: 404,
            }),
          );
        });
    });

    // it('rejects deletion of a still referenced vault', async () => {});
    // TODO: When other domains are up
  });
});
