import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncOperation } from '../sync.types';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';
import { NetworkError } from '@/git/errors/network.error';
import { forwardRef, Inject } from '@nestjs/common';
import { SyncOperationStillRunningError } from '../error/sync-still-running.error';
import { SyncRepository } from '../sync.repository';

export class PushVaultCommand {
  constructor(public readonly vaultId: SyncOperation['vaultId']) {}
}

@CommandHandler(PushVaultCommand)
export class PushVaultHandler implements ICommandHandler<PushVaultCommand> {
  constructor(
    @Inject(forwardRef(() => VaultRepository))
    private vaultRepository: VaultRepository,
    private gitService: GitService,
    private syncRepository: SyncRepository,
  ) {}

  async execute(command: PushVaultCommand) {
    const vaultInfo = await this.vaultRepository.findById(command.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultId);
    }

    await this.gitService.validateVaultGitRepo(vaultInfo.localPath);
    await this.gitService.getEffectiveRemote(vaultInfo.localPath);

    if (await this.syncRepository.getActiveSyncOperation(command.vaultId)) {
      throw new SyncOperationStillRunningError(command.vaultId, 'push');
    }

    try {
      return await this.gitService.push(vaultInfo.localPath);
    } catch (error) {
      if (error instanceof NetworkError) {
        // TODO: Handle network errors (e.g., retry later, mark vault as offline, etc.)
        throw error;
      }
      throw error;
    }
  }
}
