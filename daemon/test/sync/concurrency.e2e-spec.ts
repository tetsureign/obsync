/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { eq } from 'drizzle-orm';
import { createE2eApp, AuthedRequest } from '../helpers/test-app';
import { createTempVaultRepo } from '../helpers/test-repo';
import { waitForCompletion } from '../helpers/wait-for-completion';
import { SyncRepository } from '@/sync/sync.repository';
import { syncOperations } from '@/database/schema';

describe('Sync concurrency', () => {
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

  const seedOperation = async (
    vaultId: string,
    status: 'queued' | 'running',
    step: 'pull' | 'stage' | 'commit' | 'push',
  ) => {
    const [row] = await db.db
      .insert(syncOperations)
      .values({ vaultId, status, step })
      .returning();
    return row;
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

  it('rejects a second sync while another is active', async () => {
    await createVault('race');

    const [r1, r2] = await Promise.all([
      authedRequest().post('/vaults/race/sync').send({}),
      authedRequest().post('/vaults/race/sync').send({}),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 400]);

    const rejected = r1.status === 400 ? r1 : r2;
    expect(rejected.body.code).toBe('SYNC_OPERATION_STILL_RUNNING_ERROR');
  }, 20_000);

  it('aborts a stale running op when a new sync arrives with an idle queue', async () => {
    const { vault } = await createVault('stale');
    const stale = await seedOperation(vault.id, 'running', 'pull');

    await authedRequest().post('/vaults/stale/sync').send({}).expect(201);

    const finished = await waitForCompletion(authedRequest, 'stale', 'success');

    const historyRes = await authedRequest()
      .get('/vaults/stale/syncs')
      .expect(200);
    const history = historyRes.body as Array<{ id: string; status: string }>;
    const seededRow = history.find((op) => op.id === stale.id);
    expect(seededRow?.status).toBe('aborted');
    expect(finished.id).not.toBe(stale.id);
  }, 20_000);

  it('cannot resurrect an aborted operation through the step gate', async () => {
    const { vault } = await createVault('zombie');
    const repo = new SyncRepository(db);
    const row = await seedOperation(vault.id, 'queued', 'pull');

    const advanced = await repo.startSyncOperationStep(row.id, 'pull');
    expect(advanced?.status).toBe('running');

    await db.db
      .update(syncOperations)
      .set({ status: 'aborted' })
      .where(eq(syncOperations.id, row.id));

    expect(await repo.startSyncOperationStep(row.id, 'stage')).toBeUndefined();
    expect(
      await repo.succeedSyncOperation(row.id, { commitSha: null }),
    ).toBeUndefined();

    const { body: history } = await authedRequest()
      .get('/vaults/zombie/syncs')
      .expect(200);
    expect(history[0].status).toBe('aborted');
  });

  it('refuses granular git commands while a sync is active', async () => {
    const { vault } = await createVault('busy');
    await seedOperation(vault.id, 'running', 'commit');

    await authedRequest()
      .post('/vaults/busy/git-commit')
      .send({ commitMessage: 'nope' })
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe('SYNC_OPERATION_STILL_RUNNING_ERROR');
      });

    await authedRequest()
      .post('/vaults/busy/git-stage')
      .send({})
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe('SYNC_OPERATION_STILL_RUNNING_ERROR');
      });
  });
});
