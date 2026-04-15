import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateVaultCommand } from './create-vault.command';
import { VaultRepository } from '../vault.repository';

@CommandHandler(CreateVaultCommand)
export class CreateVaultHandler implements ICommandHandler<CreateVaultCommand> {
  constructor(private repository: VaultRepository) {}

  async execute(command: CreateVaultCommand) {
    const newVault = await this.repository.create(command);
    return newVault;
  }
}
