import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';
import { currentInstantIso } from '@/common/utils/temporal';
import { forwardRef, Inject } from '@nestjs/common';
import { SyncRepository } from '../sync.repository';
import { SyncOperationStillRunningError } from '../error/sync-still-running.error';

export class CommitVaultCommand {
  constructor(
    public readonly vaultName: string,
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
    const vaultInfo = await this.vaultRepository.findByName(command.vaultName);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultName);
    }

    await this.gitService.validateVaultGitRepo(vaultInfo.localPath);
    await this.gitService.getEffectiveRemote(vaultInfo.localPath);

    if (await this.syncRepository.getActiveSyncOperation(vaultInfo.id)) {
      throw new SyncOperationStillRunningError(command.vaultName, 'commit');
    }

    return await this.gitService.commit(
      vaultInfo.localPath,
      command.commitMessage,
    );
  }
}
