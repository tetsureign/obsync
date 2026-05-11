import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRepository } from '../sync.repository';
import { SyncOperationPayload } from '../sync.types';
import { PullVaultCommand } from './pull-vault.command';
import { PushVaultCommand } from './push-vault.command';
import { StageVaultCommand } from './stage-vault.command';
import { CommitVaultCommand } from './commit-vault.command';
import { AppError } from '@/common/errors/app.error';
import { DrizzleQueryError } from 'drizzle-orm';
import { SyncRecordPersistenceError } from '../error/sync-record-persistence.error';

export class SyncVaultCommand {
  constructor(
    public readonly vaultId: SyncOperationPayload['vaultId'],
    public readonly filePaths: string[],
    public readonly commitMessage: string,
  ) {}
}

@CommandHandler(SyncVaultCommand)
export class SyncVaultHandler implements ICommandHandler<SyncVaultCommand> {
  constructor(
    private repository: SyncRepository,
    private commandBus: CommandBus,
  ) {}

  async execute(command: SyncVaultCommand) {
    let commitSha: string | undefined;

    try {
      await this.commandBus.execute(new PullVaultCommand(command.vaultId));
      await this.commandBus.execute(
        new StageVaultCommand(command.vaultId, command.filePaths),
      );
      commitSha = await this.commandBus.execute(
        new CommitVaultCommand(command.vaultId, command.commitMessage),
      );
      await this.commandBus.execute(new PushVaultCommand(command.vaultId));

      try {
        await this.repository.create({
          vaultId: command.vaultId,
          status: 'success',
          commitSha: commitSha,
        });
      } catch (recordError) {
        if (recordError instanceof DrizzleQueryError) {
          const cause = recordError.cause;
          throw new SyncRecordPersistenceError(command.vaultId, cause);
        }

        throw recordError;
      }
    } catch (syncError) {
      try {
        await this.repository.create({
          vaultId: command.vaultId,
          status: 'failed',
          error:
            syncError instanceof AppError ? syncError.code : 'UNKNOWN_ERROR',
          commitSha,
        });
      } catch (recordError) {
        if (recordError instanceof DrizzleQueryError) {
          // TODO: log failure to persist the sync failure record.
        }
      }

      throw syncError;
    }
  }
}
