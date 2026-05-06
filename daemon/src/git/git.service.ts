import { Injectable } from '@nestjs/common';
import { simpleGit, GitError, SimpleGit } from 'simple-git';
import { NotAGitRepoError } from './errors/not-git-repo.error';
import { RemoteMismatchError } from './errors/remote-mismatch.error';
import { MergeConflictError } from './errors/merge-conflict.error';
import { RemoteAuthError } from './errors/remote-auth.error';
import { NetworkError } from './errors/network.error';
import { GitOperationError } from './errors/git-operation.error';
import { DirtyWorkingTreeError } from './errors/dirty-working-tree.error';

@Injectable()
export class GitService {
  private readonly conflictErrorString = 'CONFLICT';
  private readonly authenticationErrorString = 'Authentication failed';
  private readonly networkErrorString = 'Could not resolve host';
  private readonly dirtyWorkingTreeString =
    'Please commit your changes or stash them';

  async assertValidVault(localPath: string, expectedRemoteUrl: string) {
    await this.runGitOperation(localPath, 'check-valid-vault', async (git) => {
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
    });
  }

  async getStatus(localPath: string) {
    return await this.runGitOperation(localPath, 'status', async (git) => {
      return await git.status();
    });
  }

  async pull(localPath: string) {
    await this.runGitOperation(localPath, 'pull', async (git) => {
      await git.pull();
    });
  }

  async stage(localPath: string, filePaths: string[]) {
    await this.runGitOperation(localPath, 'stage', async (git) => {
      await git.add(filePaths);
    });
  }

  async commit(localPath: string, message: string) {
    return await this.runGitOperation(localPath, 'commit', async (git) => {
      const result = await git.commit(message);
      return result.commit;
    });
  }

  async push(localPath: string) {
    await this.runGitOperation(localPath, 'push', async (git) => {
      await git.push();
    });
  }

  async stash(localPath: string) {
    await this.runGitOperation(localPath, 'stash', async (git) => {
      await git.stash();
    });
  }

  async stashPop(localPath: string) {
    await this.runGitOperation(localPath, 'stash-pop', async (git) => {
      await git.stash(['pop']);
    });
  }

  private async runGitOperation<T>(
    localPath: string,
    operationName: string,
    operation: (git: SimpleGit) => Promise<T>,
  ): Promise<T> {
    try {
      const git = simpleGit({ baseDir: localPath });
      return await operation(git);
    } catch (error) {
      this.handleGitError(localPath, error, operationName);
    }
  }

  private handleGitError(
    localPath: string,
    error: unknown,
    operation: string,
  ): never {
    if (error instanceof GitError) {
      if (error.message.includes(this.conflictErrorString))
        throw new MergeConflictError(localPath, error.message, operation);
      if (error.message.includes(this.authenticationErrorString))
        throw new RemoteAuthError(localPath, error.message, operation);
      if (error.message.includes(this.networkErrorString))
        throw new NetworkError(localPath, error.message, operation);
      if (error.message.includes(this.dirtyWorkingTreeString))
        throw new DirtyWorkingTreeError(localPath, error.message, operation);

      throw new GitOperationError(localPath, error.message, operation);
    }

    throw error;
  }
}
