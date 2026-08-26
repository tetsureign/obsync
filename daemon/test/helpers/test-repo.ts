import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { simpleGit } from 'simple-git';

export interface TempFixture {
  path: string;
  cleanup: () => void;
}

export interface TempVaultRepo {
  localPath: string;
  originPath: string;
  cleanup: () => void;
}

function tempBase(prefix: string) {
  return mkdtempSync(join(tmpdir(), `obsync-e2e-${prefix}-`));
}

export function createTempDir(prefix: string): TempFixture {
  const path = tempBase(prefix);
  return {
    path,
    cleanup: () => rmSync(path, { recursive: true, force: true }),
  };
}

async function initGitRepo(name: string): Promise<TempFixture> {
  const base = tempBase(name);
  const localPath = join(base, name);

  const root = simpleGit({ baseDir: base });
  await root.raw(['init', '-b', 'main', localPath]);

  const local = simpleGit({ baseDir: localPath });
  await local.addConfig('user.email', 'obsync-e2e@example.com');
  await local.addConfig('user.name', 'obsync-e2e');
  writeFileSync(join(localPath, 'README.md'), '# obsync e2e\n');
  await local.add('./*.md');
  await local.commit('initial commit');

  return {
    path: localPath,
    cleanup: () => rmSync(base, { recursive: true, force: true }),
  };
}

export async function createTempGitRepo(name: string): Promise<TempFixture> {
  return initGitRepo(name);
}

export async function createTempVaultRepo(
  name: string,
): Promise<TempVaultRepo> {
  const repo = await initGitRepo(name);
  const originPath = join(dirname(repo.path), `${name}-origin.git`);

  const git = simpleGit({ baseDir: repo.path });
  await git.raw(['init', '--bare', originPath]);
  await git.addRemote('origin', originPath);
  await git.raw(['push', '-u', 'origin', 'main']);

  return {
    localPath: repo.path,
    originPath,
    cleanup: repo.cleanup,
  };
}
