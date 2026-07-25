// MVP--abort queued operations only

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRepository } from '../sync.repository';
import { AbortSyncOperationError } from '../error/abort-sync.error';
import { SyncQueue } from '@/sync-queue/sync-queue';
import { getSqliteRowsAffected } from '@/database/sqlite-result';

export class AbortSyncCommand {
  constructor(public readonly vaultName: string) {}
}

@CommandHandler(AbortSyncCommand)
export class AbortSyncHandler implements ICommandHandler<AbortSyncCommand> {
  constructor(
    private syncRepository: SyncRepository,
    private syncQueue: SyncQueue,
  ) {}

  async execute(command: AbortSyncCommand) {
    try {
      this.syncQueue.abortVaultQueue(command.vaultName);

      const dbResult =
        await this.syncRepository.abortQueuedSyncOperationByVaultName(
          command.vaultName,
        );

      if (getSqliteRowsAffected(dbResult) === 0) {
        throw new AbortSyncOperationError(
          command.vaultName,
          'No queued sync operation found to abort',
        );
      }

      return true;
    } catch (error) {
      throw new AbortSyncOperationError(command.vaultName, error);
    }
  }
}
