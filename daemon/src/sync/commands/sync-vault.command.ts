import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRepository } from '../sync.repository';
import { SyncOperation, SyncOperationPayload } from '../sync.types';
import { AppError } from '@/common/errors/app.error';
import { DrizzleQueryError } from 'drizzle-orm';
import { SyncRecordPersistenceError } from '../error/sync-record-persistence.error';
import { VaultRepository } from '@/vault/vault.repository';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { GitService } from '@/git/git.service';
import { currentInstantIso } from '@/common/utils/temporal';

export class SyncVaultCommand {
  constructor(
    public readonly vaultId: SyncOperationPayload['vaultId'],
    public readonly filePaths: string[],
    public readonly commitMessage = `auto commit at ${currentInstantIso()}`,
  ) {}
}

@CommandHandler(SyncVaultCommand)
export class SyncVaultHandler implements ICommandHandler<SyncVaultCommand> {
  constructor(
    private repository: SyncRepository,
    private vaultRepository: VaultRepository,
    private gitService: GitService,
  ) {}

  async execute(command: SyncVaultCommand) {
    let commitSha: string | undefined;
    let operation: SyncOperation | undefined;

    try {
      operation = await this.repository.queueSyncOperation(command.vaultId);

      await this.repository.runSyncOperation(operation.id, 'pull');

      const vaultInfo = await this.vaultRepository.findById(command.vaultId);
      if (!vaultInfo) {
        throw new VaultNotFoundError(command.vaultId);
      }

      await this.gitService.assertValidVault(
        vaultInfo.localPath,
        vaultInfo.remote,
      );

      await this.gitService.pull(vaultInfo.localPath);

      await this.repository.runSyncOperation(operation.id, 'stage');
      await this.gitService.stage(vaultInfo.localPath, command.filePaths);

      await this.repository.runSyncOperation(operation.id, 'commit');
      commitSha = await this.gitService.commit(
        vaultInfo.localPath,
        command.commitMessage,
      );

      await this.repository.runSyncOperation(operation.id, 'push');
      await this.gitService.push(vaultInfo.localPath);

      await this.completeOperation(operation, { commitSha });
    } catch (syncError) {
      if (operation) {
        await this.failOperation(command.vaultId, operation, syncError, {
          commitSha,
        });
      }

      throw syncError;
    }
  }

  private async completeOperation(
    operation: SyncOperation,
    payload: Pick<SyncOperationPayload, 'commitSha'>,
  ) {
    try {
      await this.repository.completeSyncOperation(operation.id, payload);
    } catch (recordError) {
      if (recordError instanceof DrizzleQueryError) {
        throw new SyncRecordPersistenceError(
          operation.vaultId,
          recordError.cause,
        );
      }

      throw recordError;
    }
  }

  private async failOperation(
    vaultId: string,
    operation: SyncOperation,
    error: unknown,
    payload: Pick<SyncOperationPayload, 'commitSha'>,
  ) {
    try {
      await this.repository.completeSyncOperation(operation.id, {
        ...payload,
        error: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
      });
    } catch (recordError) {
      if (recordError instanceof DrizzleQueryError) {
        // TODO: log failure to persist the sync failure record.
        return;
      }

      throw new SyncRecordPersistenceError(vaultId, recordError);
    }
  }
}
