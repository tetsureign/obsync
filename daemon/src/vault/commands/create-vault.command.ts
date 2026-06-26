import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { VaultPayload } from '../vault.types';
import { VaultAlreadyExistsError } from '../errors/vault-already-exists.error';
import { DrizzleQueryError } from 'drizzle-orm';
import { isSqliteUniqueConstraintError } from '@/database/sqlite-error';
import { GitService } from '@/git/git.service';
export class CreateVaultCommand {
  constructor(
    public readonly name: VaultPayload['name'],
    public readonly localPath: VaultPayload['localPath'],
    public readonly remote: VaultPayload['remote'],
    public readonly branch: VaultPayload['branch'] = 'main',
    public readonly autoSync: VaultPayload['autoSync'] = false,
    public readonly syncInterval: VaultPayload['syncInterval'] = 5 * 60,
    public readonly conflictStrategy: VaultPayload['conflictStrategy'] = 'log-and-skip',
  ) {}
}
@CommandHandler(CreateVaultCommand)
export class CreateVaultHandler implements ICommandHandler<CreateVaultCommand> {
  constructor(
    private repository: VaultRepository,
    private gitService: GitService,
  ) {}

  async execute(command: CreateVaultCommand) {
    try {
      await this.gitService.assertValidVault(command.localPath, command.remote);

      const newVault = await this.repository.create({
        name: command.name,
        localPath: command.localPath,
        remote: command.remote,
        branch: command.branch,
        autoSync: command.autoSync,
        syncInterval: command.syncInterval,
        conflictStrategy: command.conflictStrategy,
      });

      return newVault;
    } catch (error) {
      const cause = error instanceof DrizzleQueryError ? error.cause : error;

      if (isSqliteUniqueConstraintError(cause)) {
        throw new VaultAlreadyExistsError(command.name);
      }

      throw error;
    }
  }
}
