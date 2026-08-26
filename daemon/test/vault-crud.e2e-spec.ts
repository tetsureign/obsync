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
