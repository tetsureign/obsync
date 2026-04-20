import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { LibsqlError } from '@libsql/client';
import { VaultIsStillReferencedError } from '../errors/vault-still-referenced.error';
import { VaultNotFoundError } from '../errors/vault-not-found.error';

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
      if (error instanceof LibsqlError) {
        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
          throw new VaultIsStillReferencedError(command.vaultId);
        }
      }

      throw error;
    }
  }
}
