import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { UpdateVaultPayload } from '../vault.types';

export class UpdateVaultCommand {
  constructor(
    public readonly id: UpdateVaultPayload['id'],
    public readonly name?: UpdateVaultPayload['name'],
    public readonly localPath?: UpdateVaultPayload['localPath'],
    public readonly remote?: UpdateVaultPayload['remote'],
    public readonly branch?: UpdateVaultPayload['branch'],
    public readonly autoSync?: UpdateVaultPayload['autoSync'],
    public readonly syncInterval?: UpdateVaultPayload['syncInterval'],
    public readonly conflictStrategy?: UpdateVaultPayload['conflictStrategy'],
  ) {}
}
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
