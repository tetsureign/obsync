import { AppError } from '@/common/errors/app.error';
import { GitService } from '@/git/git.service';
import { Vault } from '@/vault/vault.types';
import { Injectable, Logger } from '@nestjs/common';
import { DrizzleQueryError } from 'drizzle-orm';
import pRetry from 'p-retry';
import { SyncOperationPersistenceError } from './error/sync-operation-persistence.error';
import { SyncRepository } from './sync.repository';
import { SyncOperation } from './sync.types';
import { SyncStepTransitionError } from './error/sync-step-transition.error';
import { SyncSuccessPersistenceError } from './error/sync-success-persistence.error';
import { SyncFailurePersistenceError } from './error/sync-failure-persistence.error';
import { MergeConflictError } from '@/git/errors/merge-conflict.error';
import { ConflictRepository } from '@/conflict/conflict.repository';

type SyncJob = {
  operation: SyncOperation;
  vault: Vault;
  filePaths: string[];
  commitMessage: string;
};

@Injectable()
export class SyncJobRunner {
  private readonly logger = new Logger(SyncJobRunner.name);

  constructor(
    private readonly repository: SyncRepository,
    private readonly conflictRepository: ConflictRepository,
    private readonly gitService: GitService,
  ) {}

  async run(job: SyncJob) {
    const { operation, vault, filePaths, commitMessage } = job;
    let commitSha: string | null = null;

    try {
      await this.startStepOrThrow(operation, 'pull');
      await this.gitService.validateVaultGitRepo(vault.localPath);
      await this.gitService.getEffectiveRemote(vault.localPath);
      await this.gitService.pull(vault.localPath);

      await this.startStepOrThrow(operation, 'stage');
      await this.gitService.stage(vault.localPath, filePaths);

      await this.startStepOrThrow(operation, 'commit');
      commitSha = await this.gitService
        .commit(vault.localPath, commitMessage)
        .then((result) => result.commit);

      await this.startStepOrThrow(operation, 'push');
      await this.gitService.push(vault.localPath);

      await this.recordSuccessBestEffort(operation, { commitSha });
    } catch (syncError) {
      await this.recordFailureBestEffort(job, syncError, { commitSha });

      throw syncError;
    }
  }

  private async startStepOrThrow(
    operation: SyncOperation,
    step: Exclude<SyncOperation['step'], 'done'>,
  ) {
    try {
      const updatedOperation = await this.repository.startSyncOperationStep(
        operation.id,
        step,
      );

      if (!updatedOperation) {
        throw new SyncStepTransitionError(
          operation.vaultId,
          operation.id,
          step,
        );
      }
    } catch (error) {
      if (error instanceof DrizzleQueryError) {
        throw new SyncOperationPersistenceError(operation.vaultId, error.cause);
      }

      throw error;
    }
  }

  private async recordSuccessBestEffort(
    operation: SyncOperation,
    payload: Pick<SyncOperation, 'commitSha'>,
  ) {
    try {
      await this.persistFinalStateWithRetry(operation.vaultId, async () => {
        const updatedOperation = await this.repository.succeedSyncOperation(
          operation.id,
          payload,
        );

        if (!updatedOperation) {
          throw new SyncSuccessPersistenceError(
            operation.vaultId,
            operation.id,
            {
              payload,
            },
          );
        }
      });
    } catch (error) {
      // Logs this error only. Not throwing back to app exception filter
      // Retried here; if it still fails, log only
      // If retries couldn't help it, then whatever, it's not critical info
      this.logger.error(
        `Failed to record successful sync operation ${operation.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async recordFailureBestEffort(
    syncJob: SyncJob,
    syncError: unknown,
    payload: Pick<SyncOperation, 'commitSha'>,
  ) {
    try {
      if (
        syncError instanceof MergeConflictError &&
        syncJob.vault.conflictStrategy === 'log-and-skip'
      ) {
        await this.conflictRepository.create({
          vaultId: syncJob.operation.vaultId,
          strategy: syncJob.vault.conflictStrategy,
          files: JSON.stringify(syncJob.filePaths),
        });

        // The next code path will still log the error correctly
        // Stash and retry is implemented after the CLI
      }

      await this.persistFinalStateWithRetry(
        syncJob.operation.vaultId,
        async () => {
          const updatedOperation = await this.repository.failSyncOperation(
            syncJob.operation.id,
            {
              ...payload,
              error:
                syncError instanceof AppError
                  ? syncError.code
                  : 'UNKNOWN_ERROR',
            },
          );

          if (!updatedOperation) {
            throw new SyncFailurePersistenceError(
              syncJob.operation.vaultId,
              syncJob.operation.id,
              {
                syncError,
                payload,
              },
            );
          }
        },
      );
    } catch (persistenceError) {
      this.logger.error(
        `Failed to record failed sync operation ${syncJob.operation.id}`,
        {
          persistenceError:
            persistenceError instanceof Error
              ? persistenceError.stack
              : String(persistenceError),
          syncError:
            syncError instanceof Error ? syncError.stack : String(syncError),
        },
      );
    }
  }

  private async persistFinalStateWithRetry(
    vaultId: string,
    fn: () => Promise<void>,
  ) {
    try {
      await pRetry(fn, {
        retries: 3,
        minTimeout: 500,
        factor: 2,
      });
    } catch (error) {
      if (error instanceof DrizzleQueryError) {
        throw new SyncOperationPersistenceError(vaultId, error.cause);
      }

      throw error;
    }
  }
}
