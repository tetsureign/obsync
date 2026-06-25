import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRepository } from '../sync.repository';
import { SyncOperation } from '../sync.types';
import { DrizzleQueryError } from 'drizzle-orm';
import { VaultRepository } from '@/vault/vault.repository';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { currentInstantIso } from '@/common/utils/temporal';
import { SyncQueue } from '@/sync-queue/sync-queue';
import { Logger } from '@nestjs/common';
import { SyncJobRunner } from '../sync-job.runner';
import { SyncQueueRecordPersistenceError } from '../error/sync-queue-record-persistence.error';

export class SyncVaultCommand {
  constructor(
    public readonly vaultId: SyncOperation['vaultId'],
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

  private async abortStaleSyncOperation(vaultId: string) {
    const hasWorks = this.syncQueue.hasVaultWorks(vaultId);

    if (hasWorks) {
      return null;
    }

    return this.repository.abortActiveSyncOperation(vaultId);
  }

  async execute(command: SyncVaultCommand) {
    try {
      const vaultInfo = await this.vaultRepository.findById(command.vaultId);
      if (!vaultInfo) {
        throw new VaultNotFoundError(command.vaultId);
      }

      await this.abortStaleSyncOperation(command.vaultId);

      const queuedOperation = await this.repository.queueSyncOperation(
        vaultInfo.id,
      );

      void this.syncQueue
        .addToVaultQueue(vaultInfo.id, () =>
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
      if (error instanceof DrizzleQueryError) {
        throw new SyncQueueRecordPersistenceError(command.vaultId, error.cause);
      }
      throw error;
    }
  }
}
