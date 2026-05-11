import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncOperationPayload } from '../sync.types';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';
import { NetworkError } from '@/git/errors/network.error';
import { forwardRef, Inject } from '@nestjs/common';

export class PushVaultCommand {
  constructor(public readonly vaultId: SyncOperationPayload['vaultId']) {}
}

@CommandHandler(PushVaultCommand)
export class PushVaultHandler implements ICommandHandler<PushVaultCommand> {
  constructor(
    @Inject(forwardRef(() => VaultRepository))
    private vaultRepository: VaultRepository,
    private gitService: GitService,
  ) {}

  async execute(command: PushVaultCommand) {
    const vaultInfo = await this.vaultRepository.findById(command.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultId);
    }

    await this.gitService.assertValidVault(
      vaultInfo.localPath,
      vaultInfo.remote,
    );

    try {
      await this.gitService.push(vaultInfo.localPath);
    } catch (error) {
      if (error instanceof NetworkError) {
        // TODO: Handle network errors (e.g., retry later, mark vault as offline, etc.)
        throw error;
      }
      throw error;
    }
  }
}
