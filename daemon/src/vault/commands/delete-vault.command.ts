import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { VaultIsStillReferencedError } from '../errors/vault-still-referenced.error';
import { VaultNotFoundError } from '../errors/vault-not-found.error';
import { DrizzleQueryError } from 'drizzle-orm';
import { isSqliteForeignKeyConstraintError } from '@/database/sqlite-error';
export class DeleteVaultCommand {
  constructor(public readonly vaultId: string) {}
}
@CommandHandler(DeleteVaultCommand)
export class DeleteVaultHandler implements ICommandHandler<DeleteVaultCommand> {
  constructor(private repository: VaultRepository) {}

  async execute(command: DeleteVaultCommand) {
    try {
      const deletedVault = await this.repository.delete(command.vaultId);

      if (!deletedVault) throw new VaultNotFoundError(command.vaultId);

      return deletedVault;
    } catch (error) {
      const cause = error instanceof DrizzleQueryError ? error.cause : error;

      if (isSqliteForeignKeyConstraintError(cause)) {
        throw new VaultIsStillReferencedError(command.vaultId);
      }

      throw error;
    }
  }
}
