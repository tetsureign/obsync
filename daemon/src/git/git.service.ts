import { Injectable } from '@nestjs/common';
import { simpleGit, GitError, SimpleGit } from 'simple-git';
import { NotAGitRepoError } from './errors/not-git-repo.error';
import { RemoteMismatchError } from './errors/remote-mismatch.error';
import { MergeConflictError } from './errors/merge-conflict.error';
import { RemoteAuthError } from './errors/remote-auth.error';
import { NetworkError } from './errors/network.error';
import { GitOperationError } from './errors/git-operation.error';
import { DirtyWorkingTreeError } from './errors/dirty-working-tree.error';
import { InvalidFilePathsError } from './errors/invalid-file-paths.error';

@Injectable()
export class GitService {
  private readonly conflictErrorString = 'CONFLICT';
  private readonly authenticationErrorString = 'Authentication failed';
  private readonly networkErrorString = 'Could not resolve host';
  private readonly dirtyWorkingTreeString =
    'Please commit your changes or stash them';
  private readonly notADirectory =
    'Cannot use simple-git on a directory that does not exist';
  private readonly invalidFilePaths = 'fatal: pathspec';

  async validateVaultGitRepo(localPath: string): Promise<void> {
    await this.runGitOperation(localPath, 'check-valid-vault', async (git) => {
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        throw new NotAGitRepoError(localPath);
      }
    });
  }

  async inspectExistingVault(localPath: string): Promise<{
    localPath: string;
    remote: string;
    branch: string;
  }> {
    return await this.runGitOperation(
      localPath,
      'inspect-existing-vault',
      async (git) => {
        const remotes = await git.getRemotes(true);
        const origin = remotes.find((remote) => remote.name === 'origin');
        const branchSummary = await git.branch();
        return {
          localPath,
          remote: origin?.refs.push || '',
          branch: branchSummary.current,
        };
      },
    );
  }

  async getEffectiveRemote(localPath: string): Promise<string> {
    return await this.runGitOperation(
      localPath,
      'get-effective-remote',
      async (git) => {
        const remotes = await git.getRemotes(true);
        const origin = remotes.find((r) => r.name === 'origin');
        if (!origin) {
          throw new RemoteMismatchError(localPath, 'origin', undefined);
        }
        return origin.refs.push;
      },
    );
  }

  async getEffectiveBranch(localPath: string): Promise<string> {
    return this.runGitOperation(
      localPath,
      'get-effective-branch',
      async (git) => {
        const branchSummary = await git.branch();
        return branchSummary.current;
      },
    );
  }

  async getStatus(localPath: string) {
    return await this.runGitOperation(
      localPath,
      'status',
      async (git) => await git.status(),
    );
  }

  async pull(localPath: string) {
    return await this.runGitOperation(
      localPath,
      'pull',
      async (git) => await git.pull(),
    );
  }

  async stage(localPath: string, filePaths: string[]) {
    return await this.runGitOperation(
      localPath,
      'stage',
      async (git) => await git.add(filePaths),
      filePaths,
    );
  }

  async commit(localPath: string, message: string) {
    return await this.runGitOperation(
      localPath,
      'commit',
      async (git) => await git.commit(message),
    );
  }

  async push(localPath: string) {
    return await this.runGitOperation(
      localPath,
      'push',
      async (git) => await git.push(),
    );
  }

  async diff(localPath: string, options: string[] | undefined) {
    return await this.runGitOperation(
      localPath,
      'diff',
      async (git) => await git.diff(options),
    );
  }

  async stash(localPath: string) {
    return await this.runGitOperation(
      localPath,
      'stash',
      async (git) => await git.stash(),
    );
  }

  async stashPop(localPath: string) {
    return await this.runGitOperation(
      localPath,
      'stash-pop',
      async (git) => await git.stash(['pop']),
    );
  }

  private async runGitOperation<T>(
    localPath: string,
    operationName: string,
    operation: (git: SimpleGit) => Promise<T>,
    filePaths?: string[],
  ): Promise<T> {
    try {
      const git = simpleGit({ baseDir: localPath });
      return await operation(git);
    } catch (error) {
      this.handleGitError(localPath, error, operationName, filePaths);
    }
  }

  private handleGitError(
    localPath: string,
    error: unknown,
    operation: string,
    filePaths?: string[],
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

      if (error.message.includes(this.notADirectory))
        throw new NotAGitRepoError(localPath);

      if (error.message.includes(this.invalidFilePaths) && filePaths)
        throw new InvalidFilePathsError(
          localPath,
          error.message,
          operation,
          filePaths,
        );

      throw new GitOperationError(localPath, error.message, operation);
    }

    throw error;
  }
}
