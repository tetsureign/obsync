import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRepository } from '../sync.repository';

export class SyncVaultCommand {
  constructor() {}
}

@CommandHandler(SyncVaultCommand)
export class SyncVaultHandler implements ICommandHandler<SyncVaultCommand> {
  constructor(private repository: SyncRepository) {}

  async execute(command: SyncVaultCommand) {}
}
