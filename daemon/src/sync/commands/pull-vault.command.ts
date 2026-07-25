import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';
import { MergeConflictError } from '@/git/errors/merge-conflict.error';
import { NetworkError } from '@/git/errors/network.error';
import { forwardRef, Inject } from '@nestjs/common';
import { SyncOperationStillRunningError } from '../error/sync-still-running.error';
import { SyncRepository } from '../sync.repository';

export class PullVaultCommand {
  constructor(public readonly vaultName: string) {}
}

@CommandHandler(PullVaultCommand)
export class PullVaultHandler implements ICommandHandler<PullVaultCommand> {
  constructor(
    @Inject(forwardRef(() => VaultRepository))
    private vaultRepository: VaultRepository,
    private gitService: GitService,
    private syncRepository: SyncRepository,
  ) {}

  async execute(command: PullVaultCommand) {
    const vaultInfo = await this.vaultRepository.findByName(command.vaultName);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultName);
    }

    await this.gitService.validateVaultGitRepo(vaultInfo.localPath);
    await this.gitService.getEffectiveRemote(vaultInfo.localPath);

    if (await this.syncRepository.getActiveSyncOperation(vaultInfo.id)) {
      throw new SyncOperationStillRunningError(command.vaultName, 'pull');
    }

    try {
      return await this.gitService.pull(vaultInfo.localPath);
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
