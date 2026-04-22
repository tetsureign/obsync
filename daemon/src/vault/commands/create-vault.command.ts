import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { VaultPayload } from '../vault.types';
import { LibsqlError } from '@libsql/client';
import { VaultAlreadyExistsError } from '../errors/vault-already-exists.error';
import { DrizzleQueryError } from 'drizzle-orm';
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
  constructor(private repository: VaultRepository) {}

  async execute(command: CreateVaultCommand) {
    try {
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
      if (error instanceof DrizzleQueryError) {
        const cause = error.cause;

        if (
          cause instanceof LibsqlError &&
          cause.extendedCode === 'SQLITE_CONSTRAINT_UNIQUE'
        ) {
          // This error is in extended code
          throw new VaultAlreadyExistsError(command.name);
        }
      }

      throw error;
    }
  }
}
