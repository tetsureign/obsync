import { Injectable } from '@nestjs/common';
import { simpleGit, GitError } from 'simple-git';
import { NotAGitRepoError } from './errors/not-git-repo.error';
import { RemoteMismatchError } from './errors/remote-mismatch.error';
import { MergeConflictError } from './errors/merge-conflict.error';
import { RemoteAuthError } from './errors/remote-auth.error';
import { NetworkError } from './errors/network.error';
import { GitOperationError } from './errors/git-operation.error';

@Injectable()
export class GitAdapter {
  private readonly conflictErrorString = 'CONFLICT';
  private readonly authenticationErrorString = 'Authentication failed';
  private readonly networkErrorString = 'Could not resolve host';

  async assertValidVault(localPath: string, expectedRemoteUrl: string) {
    const git = simpleGit({ baseDir: localPath });
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      throw new NotAGitRepoError(localPath);
    }

    const remotes = await git.getRemotes(true);
    const origin = remotes.find((remote) => remote.name === 'origin');
    if (origin?.refs.push !== expectedRemoteUrl) {
      throw new RemoteMismatchError(
        localPath,
        expectedRemoteUrl,
        origin?.refs.push,
      );
    }
  }

  async getStatus(localPath: string) {
    const git = simpleGit({ baseDir: localPath });
    return await git.status();
  }

  async pull(localPath: string) {
    try {
      const git = simpleGit({ baseDir: localPath });
      await git.pull();
    } catch (error) {
      if (error instanceof GitError) {
        if (error.message.includes(this.conflictErrorString))
          throw new MergeConflictError(localPath);
        if (error.message.includes(this.authenticationErrorString))
          throw new RemoteAuthError(localPath);
        if (error.message.includes(this.networkErrorString))
          throw new NetworkError(localPath);

        throw new GitOperationError(error.message);
      }
      throw error;
    }
  }

  async stage(localPath: string, filePaths: string[]) {
    const git = simpleGit({ baseDir: localPath });
    await git.add(filePaths);
  }

  async commit(localPath: string, message: string) {
    const git = simpleGit({ baseDir: localPath });
    await git.commit(message);
  }

  async push(localPath: string) {
    const git = simpleGit({ baseDir: localPath });
    await git.push();
  }
}
