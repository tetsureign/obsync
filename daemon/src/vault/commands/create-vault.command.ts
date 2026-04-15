import { Command } from '@nestjs/cqrs';
import { NewVault } from '@/vault/vault.types';

export class CreateVaultCommand extends Command<NewVault> {
  constructor(
    public readonly name: string,
    public readonly localPath: string,
    public readonly remote: string,
    public readonly branch: string = 'main',
    public readonly autoSync: boolean = false,
    public readonly syncInterval: number = 5 * 60, // in seconds
    public readonly conflictStrategy: string = 'log-and-skip',
  ) {
    super();
  }
}
