// TODO: call git and validate with git
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { UpdateVaultPayload } from '../vault.types';
import { VaultNotFoundError } from '../errors/vault-not-found.error';
import { VaultAlreadyExistsError } from '../errors/vault-already-exists.error';
import { DrizzleQueryError } from 'drizzle-orm';
import { isSqliteUniqueConstraintError } from '@/database/sqlite-error';
import { GitService } from '@/git/git.service';

export class UpdateVaultCommand {
  constructor(
    public readonly name: UpdateVaultPayload['name'],
    public readonly newName?: UpdateVaultPayload['name'],
    public readonly localPath?: UpdateVaultPayload['localPath'],
    public readonly autoSync?: UpdateVaultPayload['autoSync'],
    public readonly syncInterval?: UpdateVaultPayload['syncInterval'],
    public readonly conflictStrategy?: UpdateVaultPayload['conflictStrategy'],
  ) {}
}
@CommandHandler(UpdateVaultCommand)
export class UpdateVaultHandler implements ICommandHandler<UpdateVaultCommand> {
  constructor(
    private repository: VaultRepository,
    private gitService: GitService,
  ) {}

  async execute(command: UpdateVaultCommand) {
    try {
      if (command.localPath) {
        await this.gitService.validateVaultGitRepo(command.localPath);
        await this.gitService.getEffectiveRemote(command.localPath);
      }

      const updatedVault = await this.repository.updateByName(command.name, {
        name: command.newName,
        localPath: command.localPath,
        autoSync: command.autoSync,
        syncInterval: command.syncInterval,
        conflictStrategy: command.conflictStrategy,
      });

      if (!updatedVault) throw new VaultNotFoundError(command.name);

      return updatedVault;
    } catch (error) {
      const cause = error instanceof DrizzleQueryError ? error.cause : error;

      if (isSqliteUniqueConstraintError(cause)) {
        throw new VaultAlreadyExistsError(
          command.newName ?? command.name,
          command.localPath ?? '',
        );
      }

      throw error;
    }
  }
}
