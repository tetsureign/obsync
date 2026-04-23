/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AppModule } from '@/app.module';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

describe('Vault API', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

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

    await request(app.getHttpServer()).delete(`/vaults/${body.id}`).expect(200);

    await request(app.getHttpServer()).get(`/vaults/${body.id}`).expect(404);
  });
});
