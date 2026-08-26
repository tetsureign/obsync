/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { appendFileSync } from 'fs';
import { join } from 'path';
import { simpleGit } from 'simple-git';
import { createE2eApp, AuthedRequest } from '../helpers/test-app';
import { createTempVaultRepo } from '../helpers/test-repo';
import { waitForCompletion } from '../helpers/wait-for-completion';
import { syncOperations } from '@/database/schema';

describe('Vault sync orchestration', () => {
  let authedRequest: AuthedRequest;
  let db: Awaited<ReturnType<typeof createE2eApp>>['db'];
  let resetDb: () => Promise<void>;
  let cleanup: () => Promise<void>;
  const fixtures: Array<{ cleanup: () => void }> = [];

  const track = <T extends { cleanup: () => void }>(fixture: T) => {
    fixtures.push(fixture);
    return fixture;
  };

  const makeRepo = async (name: string) =>
    track(await createTempVaultRepo(name));

  const createVault = async (name: string) => {
    const repo = await makeRepo(name);
    const { body: vault } = await authedRequest()
      .post('/vaults')
      .send({ name, localPath: repo.localPath })
      .expect(201);
    return { repo, vault };
  };

  beforeAll(async () => {
    ({ authedRequest, db, resetDb, cleanup } = await createE2eApp());
  });

  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    for (const fixture of fixtures) fixture.cleanup();
    await cleanup();
  });

  it('runs a full sync and pushes to the remote', async () => {
    const { repo, vault } = await createVault('sync-e2e');

    appendFileSync(join(repo.localPath, 'NOTES.md'), '# changes\n');

    const { body: queued } = await authedRequest()
      .post('/vaults/sync-e2e/sync')
      .send({ commitMessage: 'e2e sync commit' })
      .expect(201);

    expect(queued).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        vaultId: vault.id,
        status: 'queued',
        step: 'pull',
        commitSha: null,
      }),
    );

    const finished = await waitForCompletion(
      authedRequest,
      'sync-e2e',
      'success',
    );

    expect(finished.id).toBe(queued.id);
    expect(finished.commitSha).toEqual(expect.any(String));
    expect(finished.step).toBe('done');

    const { body: syncedVault } = await authedRequest()
      .get('/vaults/sync-e2e')
      .expect(200);
    expect(syncedVault.lastSyncedAt).toEqual(expect.any(String));

    const localHead = await simpleGit({ baseDir: repo.localPath }).raw([
      'rev-parse',
      'main',
    ]);
    const originHead = await simpleGit({ baseDir: repo.originPath }).raw([
      'rev-parse',
      'main',
    ]);
    expect(originHead).toBe(localHead);

    const { body: history } = await authedRequest()
      .get('/vaults/sync-e2e/syncs')
      .expect(200);
    expect(history).toContainEqual(expect.objectContaining({ id: queued.id }));
  }, 20_000);

  it('reports a failed sync when the remote is gone', async () => {
    const { repo } = await createVault('gone-origin');

    await simpleGit({ baseDir: repo.localPath }).raw([
      'remote',
      'remove',
      'origin',
    ]);

    const { body: queued } = await authedRequest()
      .post('/vaults/gone-origin/sync')
      .send({})
      .expect(201);
    expect(queued.status).toBe('queued');

    const finished = await waitForCompletion(
      authedRequest,
      'gone-origin',
      'failed',
    );

    expect(finished.error).toBe('REMOTE_NOT_FOUND');
    expect(finished.commitSha).toBeNull();

    const { body: untouchedVault } = await authedRequest()
      .get('/vaults/gone-origin')
      .expect(200);
    expect(untouchedVault.lastSyncedAt).toBeNull();
  }, 20_000);

  it('marks a sync with no changes as succeeded without a commit', async () => {
    // Current behavior: git commit with nothing staged is tolerated by
    // simple-git, so an up-to-date vault succeeds with a null commit sha.
    await createVault('no-changes');

    await authedRequest().post('/vaults/no-changes/sync').send({}).expect(201);

    const finished = await waitForCompletion(
      authedRequest,
      'no-changes',
      'success',
    );
    // Nothing to commit -> recorded as success with a null commit sha.
    expect(finished.commitSha).toBeNull();
  }, 20_000);

  it('aborts a queued sync operation', async () => {
    const { vault } = await createVault('abort-me');

    await db.db
      .insert(syncOperations)
      .values({ vaultId: vault.id, status: 'queued', step: 'pull' });

    await authedRequest()
      .post('/vaults/abort-me/abort')
      .send({})
      .expect(201)
      .expect((res) => {
        expect(res.body).toBe(true);
      });

    const { body: history } = await authedRequest()
      .get('/vaults/abort-me/syncs')
      .expect(200);
    expect(history[0].status).toBe('aborted');
  });

  it('rejects aborting when nothing is queued', async () => {
    await createVault('nothing-to-abort');

    await authedRequest()
      .post('/vaults/nothing-to-abort/abort')
      .send({})
      .expect(400)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.objectContaining({
            statusCode: 400,
            code: 'SYNC_NOTHING_QUEUED',
          }),
        );
      });
  });

  it('rejects invalid sync bodies', async () => {
    await createVault('body-checks');

    await authedRequest()
      .post('/vaults/body-checks/sync')
      .send({ filePaths: 'not-an-array' })
      .expect(400);
    await authedRequest()
      .post('/vaults/body-checks/git-stage')
      .send({ filePaths: 123 })
      .expect(400);
    await authedRequest()
      .post('/vaults/body-checks/git-commit')
      .send({ commitMessage: 123 })
      .expect(400);
  });

  it('rejects sync routes for a nonexistent vault', async () => {
    const cases: Array<['get' | 'post', string]> = [
      ['post', '/vaults/nope/sync'],
      ['post', '/vaults/nope/abort'],
      ['get', '/vaults/nope/status'],
      ['get', '/vaults/nope/syncs'],
      ['get', '/vaults/nope/git-status'],
      ['get', '/vaults/nope/git-diff'],
      ['post', '/vaults/nope/git-pull'],
      ['post', '/vaults/nope/git-stage'],
      ['post', '/vaults/nope/git-commit'],
      ['post', '/vaults/nope/git-push'],
    ];

    for (const [method, url] of cases) {
      const req = authedRequest()[method](url);
      if (method === 'post') req.send({});
      await req.expect(404);
    }
  });
});
