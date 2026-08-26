import { createE2eApp, AuthedRequest } from './helpers/test-app';
import {
  createTempDir,
  createTempGitRepo,
  createTempVaultRepo,
} from './helpers/test-repo';

describe('Vault domain errors', () => {
  const nonexistentVaultName = 'does-not-exist';

  let authedRequest: AuthedRequest;
  let resetDb: () => Promise<void>;
  let cleanup: () => Promise<void>;
  const fixtures: Array<{ cleanup: () => void }> = [];

  const track = <T extends { cleanup: () => void }>(fixture: T) => {
    fixtures.push(fixture);
    return fixture;
  };

  const makeRepo = async (name: string) =>
    track(await createTempVaultRepo(name));

  beforeAll(async () => {
    ({ authedRequest, resetDb, cleanup } = await createE2eApp());
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    for (const fixture of fixtures) fixture.cleanup();
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

  it('rejects getting a nonexistent vault name', async () => {
    await authedRequest()
      .get(`/vaults/${nonexistentVaultName}`)
      .expect(404)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 404,
          }),
        );
      });
  });

  it('rejects by-path lookup for an unregistered path', async () => {
    await authedRequest()
      .get('/vaults/by-path')
      .query({ localPath: '/definitely/not/registered' })
      .expect(404)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 404,
          }),
        );
      });
  });

  it('rejects creating a vault outside a git repository', async () => {
    const dir = track(createTempDir('not-a-repo'));

    await authedRequest()
      .post('/vaults')
      .send({ name: 'not-a-repo', localPath: dir.path })
      .expect(400)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 400,
            code: 'NOT_A_GIT_REPO',
          }),
        );
      });
  });

  it('rejects creating a vault without an origin remote', async () => {
    const repo = track(await createTempGitRepo('no-origin'));

    await authedRequest()
      .post('/vaults')
      .send({ name: 'no-origin', localPath: repo.path })
      .expect(404)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 404,
            code: 'REMOTE_NOT_FOUND',
          }),
        );
      });
  });

  it('rejects updating localPath outside a git repository', async () => {
    const repo = await makeRepo('update-invalid');
    await authedRequest()
      .post('/vaults')
      .send({ name: 'update-invalid', localPath: repo.localPath })
      .expect(201);

    const dir = track(createTempDir('plain-dir'));
    await authedRequest()
      .patch('/vaults/update-invalid')
      .send({ localPath: dir.path })
      .expect(400)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 400,
            code: 'NOT_A_GIT_REPO',
          }),
        );
      });
  });

  // it('rejects deletion of a still referenced vault', async () => {});
  // TODO: When other domains are up
});
