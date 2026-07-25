import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { VaultNotFoundError } from '../errors/vault-not-found.error';
import { VaultIsStillReferencedError } from '../errors/vault-still-referenced.error';
import { DrizzleQueryError } from 'drizzle-orm';
import { isSqliteForeignKeyConstraintError } from '@/database/sqlite-error';

export class DeleteVaultCommand {
  constructor(public readonly vaultName: string) {}
}

@CommandHandler(DeleteVaultCommand)
export class DeleteVaultHandler implements ICommandHandler<DeleteVaultCommand> {
  constructor(private repository: VaultRepository) {}

  async execute(command: DeleteVaultCommand) {
    try {
      const deletedVault = await this.repository.deleteByName(
        command.vaultName,
      );

      if (!deletedVault) throw new VaultNotFoundError(command.vaultName);

      return deletedVault;
    } catch (error) {
      const cause = error instanceof DrizzleQueryError ? error.cause : error;

      if (isSqliteForeignKeyConstraintError(cause)) {
        throw new VaultIsStillReferencedError(command.vaultName);
      }

      throw error;
    }
  }
}
