// MVP--abort queued operations only

import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncOperationPayload } from '../sync.types';
import { SyncRepository } from '../sync.repository';
import { AbortSyncOperationError } from '../error/abort-sync.error';
import { SyncQueue } from '@/sync-queue/sync-queue';

export class AbortSyncCommand {
  constructor(public readonly vaultId: SyncOperationPayload['vaultId']) {}
}

@CommandHandler(AbortSyncCommand)
export class AbortSyncHandler implements ICommandHandler<AbortSyncCommand> {
  constructor(
    private syncRepository: SyncRepository,
    private syncQueue: SyncQueue,
  ) {}

  async execute(command: AbortSyncCommand) {
    try {
      this.syncQueue.abortVaultQueue(command.vaultId);

      const dbResult = await this.syncRepository.abortQueuedSyncOperation(
        command.vaultId,
      );

      if (dbResult.rowsAffected === 0) {
        throw new AbortSyncOperationError(
          command.vaultId,
          'No queued sync operation found to abort',
        );
      }

      return true;
    } catch (error) {
      throw new AbortSyncOperationError(command.vaultId, error);
    }
  }
}
