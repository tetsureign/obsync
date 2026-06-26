import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncOperation } from '../sync.types';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';
import { currentInstantIso } from '@/common/utils/temporal';
import { forwardRef, Inject } from '@nestjs/common';
import { SyncRepository } from '../sync.repository';
import { SyncOperationStillRunningError } from '../error/sync-still-running.error';

export class CommitVaultCommand {
  constructor(
    public readonly vaultId: SyncOperation['vaultId'],
    public readonly commitMessage: string = `auto commit at ${currentInstantIso()}`,
  ) {}
}

@CommandHandler(CommitVaultCommand)
export class CommitVaultHandler implements ICommandHandler<CommitVaultCommand> {
  constructor(
    @Inject(forwardRef(() => VaultRepository))
    private vaultRepository: VaultRepository,
    private gitService: GitService,
    private syncRepository: SyncRepository,
  ) {}

  async execute(command: CommitVaultCommand) {
    const vaultInfo = await this.vaultRepository.findById(command.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultId);
    }

    await this.gitService.assertValidVault(
      vaultInfo.localPath,
      vaultInfo.remote,
    );

    if (await this.syncRepository.getActiveSyncOperation(command.vaultId)) {
      throw new SyncOperationStillRunningError(command.vaultId, 'commit');
    }

    return await this.gitService.commit(
      vaultInfo.localPath,
      command.commitMessage,
    );
  }
}
