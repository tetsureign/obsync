import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { VaultPayload } from '../vault.types';
import { VaultAlreadyExistsError } from '../errors/vault-already-exists.error';
import { DrizzleQueryError } from 'drizzle-orm';
import { isSqliteUniqueConstraintError } from '@/database/sqlite-error';
import { GitService } from '@/git/git.service';
export class CreateVaultCommand {
  constructor(
    public readonly localPath: VaultPayload['localPath'],
    public readonly name?: VaultPayload['name'],
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
    let name = command.name;
    if (!name) {
      // If name is not provided, derive it from the localPath
      const pathSegments = command.localPath.split('/');
      name = pathSegments[pathSegments.length - 1] || 'default-vault-name';
    }

    try {
      await this.gitService.validateVaultGitRepo(command.localPath);
      await this.gitService.getEffectiveRemote(command.localPath);

      const newVault = await this.repository.create({
        name,
        localPath: command.localPath,
        autoSync: command.autoSync,
        syncInterval: command.syncInterval,
        conflictStrategy: command.conflictStrategy,
      });

      return newVault;
    } catch (error) {
      const cause = error instanceof DrizzleQueryError ? error.cause : error;

      if (isSqliteUniqueConstraintError(cause)) {
        throw new VaultAlreadyExistsError(name, command.localPath);
      }

      throw error;
    }
  }
}
