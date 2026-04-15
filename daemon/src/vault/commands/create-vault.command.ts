import { VaultPayload } from '../vault.types';

export class CreateVaultCommand {
  constructor(
    public readonly name: VaultPayload['name'],
    public readonly localPath: VaultPayload['localPath'],
    public readonly remote: VaultPayload['remote'],
    public readonly branch: VaultPayload['branch'] = 'main',
    public readonly autoSync: VaultPayload['autoSync'] = false,
    public readonly syncInterval: VaultPayload['syncInterval'] = 5 * 60,
    public readonly conflictStrategy: VaultPayload['conflictStrategy'] = 'log-and-skip',
  ) {}
}
