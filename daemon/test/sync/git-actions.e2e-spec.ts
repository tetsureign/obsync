/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { appendFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { simpleGit } from 'simple-git';
import { createE2eApp, AuthedRequest } from '../helpers/test-app';
import { createTempVaultRepo } from '../helpers/test-repo';

describe('Vault granular git endpoints', () => {
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

  const createVault = async (name: string) => {
    const repo = await makeRepo(name);
    await authedRequest()
      .post('/vaults')
      .send({ name, localPath: repo.localPath })
      .expect(201);
    return repo;
  };

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

  it('reports a clean git status initially', async () => {
    await createVault('clean-status');

    const { body } = await authedRequest()
      .get('/vaults/clean-status/git-status')
      .expect(200);

    expect(body.files).toEqual([]);
    expect(body.staged).toEqual([]);
    expect(body.tracking).toBe('origin/main');
  });

  it('shows unstaged changes in git diff', async () => {
    const repo = await createVault('diff-check');
    appendFileSync(join(repo.localPath, 'README.md'), 'more text\n');

    const { text } = await authedRequest()
      .get('/vaults/diff-check/git-diff')
      .expect(200);

    expect(text).toContain('+more text');

    const cached = await authedRequest()
      .get('/vaults/diff-check/git-diff')
      .query({ options: ['--cached'] })
      .expect(200);
    expect(cached.text).toBe('');
  });

  it('stages specified files', async () => {
    const repo = await createVault('stage-me');
    writeFileSync(join(repo.localPath, 'notes.md'), '# notes\n');

    await authedRequest()
      .post('/vaults/stage-me/git-stage')
      .send({ filePaths: ['notes.md'] })
      .expect(201)
      .expect((res) => {
        expect(res.body).toBe(true);
      });

    const { body } = await authedRequest()
      .get('/vaults/stage-me/git-status')
      .expect(200);
    expect(body.staged).toContain('notes.md');
  });

  it('commits staged changes and leaves the tree clean', async () => {
    const repo = await createVault('commit-me');
    appendFileSync(join(repo.localPath, 'README.md'), 'commit me\n');

    await authedRequest()
      .post('/vaults/commit-me/git-stage')
      .send({})
      .expect(201);

    await authedRequest()
      .post('/vaults/commit-me/git-commit')
      .send({ commitMessage: 'manual e2e commit' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toBe(true);
      });

    const { body } = await authedRequest()
      .get('/vaults/commit-me/git-status')
      .expect(200);
    expect(body.files).toEqual([]);

    const log = await simpleGit({ baseDir: repo.localPath }).raw([
      'log',
      '-1',
      '--format=%s',
    ]);
    expect(log.trim()).toBe('manual e2e commit');
  });

  it('pushes commits to the origin remote', async () => {
    const repo = await createVault('push-me');
    appendFileSync(join(repo.localPath, 'README.md'), 'push me\n');

    await authedRequest()
      .post('/vaults/push-me/git-stage')
      .send({})
      .expect(201);
    await authedRequest()
      .post('/vaults/push-me/git-commit')
      .send({ commitMessage: 'push e2e' })
      .expect(201);
    await authedRequest()
      .post('/vaults/push-me/git-push')
      .send({})
      .expect(201)
      .expect((res) => {
        expect(res.body).toBe(true);
      });

    const localHead = (
      await simpleGit({ baseDir: repo.localPath }).raw(['rev-parse', 'main'])
    ).trim();
    const originHead = (
      await simpleGit({ baseDir: repo.originPath }).raw(['rev-parse', 'main'])
    ).trim();
    expect(originHead).toBe(localHead);
  });

  it('pulls from the origin remote', async () => {
    await createVault('pull-me');

    await authedRequest()
      .post('/vaults/pull-me/git-pull')
      .send({})
      .expect(201)
      .expect((res) => {
        expect(res.body).toBe(true);
      });
  });
});
