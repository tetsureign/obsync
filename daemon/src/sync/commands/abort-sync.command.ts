// MVP--abort queued operations only

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRepository } from '../sync.repository';
import { AbortSyncOperationError } from '../error/abort-sync.error';
import { SyncNothingQueuedError } from '../error/sync-nothing-queued.error';
import { SyncQueue } from '@/sync-queue/sync-queue';
import { getSqliteRowsAffected } from '@/database/sqlite-result';
import { VaultRepository } from '@/vault/vault.repository';
import { Inject, forwardRef } from '@nestjs/common';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';

export class AbortSyncCommand {
  constructor(public readonly vaultName: string) {}
}

@CommandHandler(AbortSyncCommand)
export class AbortSyncHandler implements ICommandHandler<AbortSyncCommand> {
  constructor(
    private syncRepository: SyncRepository,
    private syncQueue: SyncQueue,
    @Inject(forwardRef(() => VaultRepository))
    private vaultRepository: VaultRepository,
  ) {}

  async execute(command: AbortSyncCommand) {
    const vault = await this.vaultRepository.findByName(command.vaultName);

    if (!vault) {
      throw new VaultNotFoundError(command.vaultName);
    }

    try {
      this.syncQueue.abortVaultQueue(command.vaultName);

      const dbResult =
        await this.syncRepository.abortQueuedSyncOperationByVaultName(
          command.vaultName,
        );

      if (getSqliteRowsAffected(dbResult) === 0) {
        throw new SyncNothingQueuedError(command.vaultName);
      }

      return true;
    } catch (error) {
      if (error instanceof SyncNothingQueuedError) {
        throw error;
      }

      throw new AbortSyncOperationError(command.vaultName, error);
    }
  }
}
