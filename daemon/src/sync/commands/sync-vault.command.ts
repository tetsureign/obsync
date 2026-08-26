import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRepository } from '../sync.repository';
import { DrizzleQueryError } from 'drizzle-orm';
import { VaultRepository } from '@/vault/vault.repository';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { currentInstantIso } from '@/common/utils/temporal';
import { SyncQueue } from '@/sync-queue/sync-queue';
import { Logger } from '@nestjs/common';
import { SyncJobRunner } from '../sync-job.runner';
import { SyncQueueRecordPersistenceError } from '../error/sync-queue-record-persistence.error';
import { isSqliteUniqueConstraintError } from '@/database/sqlite-error';
import { SyncOperationStillRunningError } from '../error/sync-still-running.error';

export class SyncVaultCommand {
  constructor(
    public readonly vaultName: string,
    public readonly filePaths: string[] = ['.'],
    public readonly commitMessage = `auto commit at ${currentInstantIso()}`,
  ) {}
}

@CommandHandler(SyncVaultCommand)
export class SyncVaultHandler implements ICommandHandler<SyncVaultCommand> {
  constructor(
    private repository: SyncRepository,
    private vaultRepository: VaultRepository,
    private syncQueue: SyncQueue,
    private syncJobRunner: SyncJobRunner,
  ) {}
  private readonly logger = new Logger(SyncVaultHandler.name);

  private async abortStaleSyncOperation(vaultName: string) {
    // Queue is keyed by name — no id lookup needed
    if (this.syncQueue.hasVaultWorks(vaultName)) {
      return null;
    }

    return this.repository.abortActiveSyncOperationByVaultName(vaultName);
  }

  async execute(command: SyncVaultCommand) {
    const vaultInfo = await this.vaultRepository.findByName(command.vaultName);
    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultName);
    }

    try {
      await this.abortStaleSyncOperation(command.vaultName);

      const queuedOperation = await this.repository.queueSyncOperation(
        vaultInfo.id,
      );

      void this.syncQueue
        .addToVaultQueue(command.vaultName, () =>
          this.syncJobRunner.run({
            operation: queuedOperation,
            vault: vaultInfo,
            filePaths: command.filePaths,
            commitMessage: command.commitMessage,
          }),
        )
        .catch((error) => {
          this.logger.error(
            `Failed to run queued sync job ${queuedOperation.id}`,
            error instanceof Error ? error.stack : String(error),
          );
        });
      return queuedOperation;
    } catch (error) {
      const cause = error instanceof DrizzleQueryError ? error.cause : error;

      // Two active ops per vault violate the partial unique index — the
      // second request lost a race against an in-flight sync.
      if (isSqliteUniqueConstraintError(cause)) {
        throw new SyncOperationStillRunningError(vaultInfo.id, 'sync');
      }

      if (error instanceof DrizzleQueryError) {
        throw new SyncQueueRecordPersistenceError(command.vaultName, cause);
      }
      throw error;
    }
  }
}
