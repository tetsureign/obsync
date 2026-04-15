import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';

export class DeleteVaultCommand {
  constructor(public readonly vaultId: string) {}
}
@CommandHandler(DeleteVaultCommand)
export class DeleteVaultHandler implements ICommandHandler<DeleteVaultCommand> {
  constructor(private repository: VaultRepository) {}

  async execute(command: DeleteVaultCommand) {
    const deletedVault = await this.repository.delete(command.vaultId);
    return deletedVault;
  }
}
