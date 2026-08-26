/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { createE2eApp, AuthedRequest } from './helpers/test-app';
import { createTempVaultRepo, TempVaultRepo } from './helpers/test-repo';

describe('Vault CRUD API', () => {
  let authedRequest: AuthedRequest;
  let resetDb: () => Promise<void>;
  let cleanup: () => Promise<void>;
  const repos: TempVaultRepo[] = [];

  const makeRepo = async (name: string) => {
    const repo = await createTempVaultRepo(name);
    repos.push(repo);
    return repo;
  };

  beforeAll(async () => {
    ({ authedRequest, resetDb, cleanup } = await createE2eApp());
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    for (const repo of repos) repo.cleanup();
    await cleanup();
  });

  it('should create a vault', async () => {
    const repo = await makeRepo('work');
    const payload = { name: 'work', localPath: repo.localPath };

    const createRes = await authedRequest()
      .post('/vaults')
      .send(payload)
      .expect(201);

    expect(createRes.body).toEqual(
      expect.objectContaining({
        ...payload,
        id: expect.any(String),
        autoSync: false,
        syncInterval: 300,
        conflictStrategy: 'log-and-skip',
        isDirty: false,
        lastSyncedAt: null,
      }),
    );

    await authedRequest()
      .get(`/vaults/${payload.name}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(createRes.body.id);
      });
  });

  it('derives the vault name from localPath when omitted', async () => {
    const repo = await makeRepo('derived-name');

    const res = await authedRequest()
      .post('/vaults')
      .send({ localPath: repo.localPath })
      .expect(201);

    expect(res.body.name).toBe('derived-name');

    await authedRequest().get('/vaults/derived-name').expect(200);
  });

  it('fetches a vault by path', async () => {
    const repo = await makeRepo('by-path');
    await authedRequest()
      .post('/vaults')
      .send({ name: 'by-path', localPath: repo.localPath })
      .expect(201);

    await authedRequest()
      .get('/vaults/by-path')
      .query({ localPath: repo.localPath })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('by-path');
      });
  });

  it('list vaults', async () => {
    const repo = await makeRepo('listed');
    await authedRequest()
      .post('/vaults')
      .send({ name: 'listed', localPath: repo.localPath })
      .expect(201);

    await authedRequest()
      .get('/vaults')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toContainEqual(
          expect.objectContaining({ name: 'listed' }),
        );
      });
  });

  it('updates a vault', async () => {
    const repo = await makeRepo('docs');
    await authedRequest()
      .post('/vaults')
      .send({ name: 'docs', localPath: repo.localPath })
      .expect(201);

    await authedRequest()
      .patch('/vaults/docs')
      .send({ autoSync: true, syncInterval: 120 })
      .expect(200)
      .expect((res) => {
        expect(res.body.autoSync).toBe(true);
        expect(res.body.syncInterval).toBe(120);
      });
  });

  it('renames a vault', async () => {
    const repo = await makeRepo('rename-me');
    await authedRequest()
      .post('/vaults')
      .send({ name: 'rename-me', localPath: repo.localPath })
      .expect(201);

    await authedRequest()
      .patch('/vaults/rename-me')
      .send({ name: 'renamed' })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('renamed');
      });

    await authedRequest().get('/vaults/rename-me').expect(404);
    await authedRequest().get('/vaults/renamed').expect(200);
  });

  it('moves a vault to another valid repository', async () => {
    const repoA = await makeRepo('mover');
    const repoB = await makeRepo('move-target');
    await authedRequest()
      .post('/vaults')
      .send({ name: 'mover', localPath: repoA.localPath })
      .expect(201);

    await authedRequest()
      .patch('/vaults/mover')
      .send({ localPath: repoB.localPath })
      .expect(200)
      .expect((res) => {
        expect(res.body.localPath).toBe(repoB.localPath);
      });
  });

  it('deletes a vault', async () => {
    const repo = await makeRepo('temp');
    await authedRequest()
      .post('/vaults')
      .send({ name: 'temp', localPath: repo.localPath })
      .expect(201);

    await authedRequest().delete('/vaults/temp').expect(200);

    await authedRequest().get('/vaults/temp').expect(404);
  });
});
