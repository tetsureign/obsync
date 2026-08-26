import { createE2eApp, AuthedRequest } from './helpers/test-app';
import { createTempVaultRepo, TempVaultRepo } from './helpers/test-repo';

describe('Vault validation', () => {
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

  // malformed body, invalid enum, missing required fields

  it('rejects missing required fields on create', async () => {
    await authedRequest()
      .post('/vaults')
      .send({ name: 'invalid' }) // Missing required fields
      .expect(400);
  });

  it('rejects invalid conflictStrategy values', async () => {
    await authedRequest()
      .post('/vaults')
      .send({
        name: 'invalid',
        localPath: '/tmp/invalid',
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

  it('rejects relative localPath values', async () => {
    await authedRequest()
      .post('/vaults')
      .send({
        name: 'invalid',
        localPath: 'relative/path', // Not an absolute path
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

  it('rejects path traversal in localPath', async () => {
    await authedRequest()
      .post('/vaults')
      .send({
        name: 'invalid',
        localPath: '/tmp/obsync-e2e/../traversal', // Contains '..'
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
    await authedRequest()
      .post('/vaults')
      .send({
        name: 'invalid',
        localPath: '/tmp/invalid',
        syncInterval: 'not-a-number', // Invalid type
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
    const repo = await makeRepo('test');
    await authedRequest()
      .post('/vaults')
      .send({ name: 'test', localPath: repo.localPath })
      .expect(201);

    await authedRequest()
      .patch('/vaults/test')
      .send({ syncInterval: 'not-a-number' }) // Invalid type
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
    const repo = await makeRepo('partial-update');
    await authedRequest()
      .post('/vaults')
      .send({ name: 'partial-update', localPath: repo.localPath })
      .expect(201);

    await authedRequest()
      .patch('/vaults/partial-update')
      .send({ conflictStrategy: 'stash-and-retry' })
      .expect(200);
  });

  it('rejects by-path lookup without localPath query', async () => {
    await authedRequest()
      .get('/vaults/by-path')
      .expect(400)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 400,
          }),
        );
      });
  });
});
