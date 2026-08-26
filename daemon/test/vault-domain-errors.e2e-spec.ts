import { createE2eApp, AuthedRequest } from './helpers/test-app';
import { createTempVaultRepo, TempVaultRepo } from './helpers/test-repo';

describe('Vault domain errors', () => {
  const nonexistentVaultName = 'does-not-exist';

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

  // not found, duplicate name, duplicate localPath, etc.

  it('rejects duplicate vault name creation', async () => {
    const repoA = await makeRepo('duplicate-a');
    const repoB = await makeRepo('duplicate-b');

    await authedRequest()
      .post('/vaults')
      .send({ name: 'duplicate', localPath: repoA.localPath })
      .expect(201);

    await authedRequest()
      .post('/vaults')
      .send({ name: 'duplicate', localPath: repoB.localPath })
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
    const repoW = await makeRepo('whatever-w');
    const repoD = await makeRepo('duplicate-d');

    await authedRequest()
      .post('/vaults')
      .send({ name: 'whatever', localPath: repoW.localPath })
      .expect(201);

    await authedRequest()
      .post('/vaults')
      .send({ name: 'duplicate', localPath: repoD.localPath })
      .expect(201);

    // Renames 'whatever' to the already-taken 'duplicate'
    await authedRequest()
      .patch('/vaults/whatever')
      .send({ name: 'duplicate' })
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
    const repo = await makeRepo('shared-path');

    await authedRequest()
      .post('/vaults')
      .send({ name: 'whatever', localPath: repo.localPath })
      .expect(201);

    await authedRequest()
      .post('/vaults')
      .send({ name: 'duplicate', localPath: repo.localPath })
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
    const repoW = await makeRepo('whatever-l');
    const repoD = await makeRepo('duplicate-l');

    await authedRequest()
      .post('/vaults')
      .send({ name: 'whatever', localPath: repoW.localPath })
      .expect(201);

    await authedRequest()
      .post('/vaults')
      .send({ name: 'duplicate', localPath: repoD.localPath })
      .expect(201);

    // Points 'whatever' at the path already owned by 'duplicate'
    await authedRequest()
      .patch('/vaults/whatever')
      .send({ localPath: repoD.localPath })
      .expect(409)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 409,
          }),
        );
      });
  });

  it('rejects nonexistent vault update name', async () => {
    await authedRequest()
      .patch(`/vaults/${nonexistentVaultName}`)
      .send({ autoSync: true })
      .expect(404)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 404,
          }),
        );
      });
  });

  it('rejects nonexistent vault delete name', async () => {
    await authedRequest()
      .delete(`/vaults/${nonexistentVaultName}`)
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
