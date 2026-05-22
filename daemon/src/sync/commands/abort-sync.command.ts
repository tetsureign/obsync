import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncOperationPayload } from '../sync.types';
import { SyncRepository } from '../sync.repository';
import { AbortSyncOperationError } from '../error/abort-sync.error';

export class AbortSyncCommand {
  constructor(public readonly vaultId: SyncOperationPayload['vaultId']) {}
}

@CommandHandler(AbortSyncCommand)
export class AbortSyncHandler implements ICommandHandler<AbortSyncCommand> {
  constructor(private syncRepository: SyncRepository) {}

  async execute(command: AbortSyncCommand) {
    try {
      await this.syncRepository.abortActiveSyncOperation(command.vaultId);
    } catch (queryError) {
      throw new AbortSyncOperationError(command.vaultId, queryError);
    }
  }
}
