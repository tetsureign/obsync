import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteVaultCommand } from './delete-vault.command';
import { VaultRepository } from '../vault.repository';

@CommandHandler(DeleteVaultCommand)
export class DeleteVaultHandler implements ICommandHandler<DeleteVaultCommand> {
  constructor(private repository: VaultRepository) {}

  async execute(command: DeleteVaultCommand) {
    const deletedVault = await this.repository.delete(command.vaultId);
    return deletedVault;
  }
}
