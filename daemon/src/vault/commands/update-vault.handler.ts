import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateVaultCommand } from './update-vault.command';
import { VaultRepository } from '../vault.repository';

@CommandHandler(UpdateVaultCommand)
export class UpdateVaultHandler implements ICommandHandler<UpdateVaultCommand> {
  constructor(private repository: VaultRepository) {}

  async execute(command: UpdateVaultCommand) {
    const updatedVault = await this.repository.updateById(command.id, {
      name: command.name,
      localPath: command.localPath,
      remote: command.remote,
      branch: command.branch,
      autoSync: command.autoSync,
      syncInterval: command.syncInterval,
      conflictStrategy: command.conflictStrategy,
    });
    return updatedVault;
  }
}
