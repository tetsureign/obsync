import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncOperationPayload } from '../sync.types';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';
import { MergeConflictError } from '@/git/errors/merge-conflict.error';
import { NetworkError } from '@/git/errors/network.error';
import { forwardRef, Inject } from '@nestjs/common';

export class PullVaultCommand {
  constructor(public readonly vaultId: SyncOperationPayload['vaultId']) {}
}

@CommandHandler(PullVaultCommand)
export class PullVaultHandler implements ICommandHandler<PullVaultCommand> {
  constructor(
    @Inject(forwardRef(() => VaultRepository))
    private vaultRepository: VaultRepository,
    private gitService: GitService,
  ) {}

  async execute(command: PullVaultCommand) {
    const vaultInfo = await this.vaultRepository.findById(command.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultId);
    }

    await this.gitService.assertValidVault(
      vaultInfo.localPath,
      vaultInfo.remote,
    );

    try {
      await this.gitService.pull(vaultInfo.localPath);
    } catch (error) {
      if (error instanceof MergeConflictError) {
        // Call ConflictModule to resolve the conflict and retry pulling
        // TODO: implement conflict resolution and retry logic
        throw error;
      }

      if (error instanceof NetworkError) {
        // TODO: Handle network errors (e.g., retry later, mark vault as offline, etc.)
        throw error;
      }
      throw error;
    }
  }
}
