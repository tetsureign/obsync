import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { simpleGit } from 'simple-git';

export interface TempVaultRepo {
  localPath: string;
  originPath: string;
  cleanup: () => void;
}

export async function createTempVaultRepo(
  name: string,
): Promise<TempVaultRepo> {
  const base = mkdtempSync(join(tmpdir(), `obsync-e2e-${name}-`));
  const localPath = join(base, name);
  const originPath = join(base, `${name}-origin.git`);

  const root = simpleGit({ baseDir: base });
  await root.raw(['init', '--bare', originPath]);
  await root.raw(['init', '-b', 'main', localPath]);

  const local = simpleGit({ baseDir: localPath });
  await local.addRemote('origin', originPath);
  await local.addConfig('user.email', 'obsync-e2e@example.com');
  await local.addConfig('user.name', 'obsync-e2e');
  writeFileSync(join(localPath, 'README.md'), '# obsync e2e\n');
  await local.add('./*.md');
  await local.commit('initial commit');

  return {
    localPath,
    originPath,
    cleanup: () => rmSync(base, { recursive: true, force: true }),
  };
}
