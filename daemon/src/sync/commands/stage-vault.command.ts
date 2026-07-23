import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncOperation } from '../sync.types';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';
import { forwardRef, Inject } from '@nestjs/common';
import { SyncOperationStillRunningError } from '../error/sync-still-running.error';
import { SyncRepository } from '../sync.repository';

export class StageVaultCommand {
  constructor(
    public readonly vaultId: SyncOperation['vaultId'],
    public readonly filePaths: string[] = ['.'], // Defaults to staging all changes
  ) {}
}

@CommandHandler(StageVaultCommand)
export class StageVaultHandler implements ICommandHandler<StageVaultCommand> {
  constructor(
    @Inject(forwardRef(() => VaultRepository))
    private vaultRepository: VaultRepository,
    private gitService: GitService,
    private syncRepository: SyncRepository,
  ) {}

  async execute(command: StageVaultCommand) {
    const vaultInfo = await this.vaultRepository.findById(command.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultId);
    }

    await this.gitService.validateVaultGitRepo(vaultInfo.localPath);
    await this.gitService.getEffectiveRemote(vaultInfo.localPath);

    if (await this.syncRepository.getActiveSyncOperation(command.vaultId)) {
      throw new SyncOperationStillRunningError(command.vaultId, 'stage');
    }

    return await this.gitService.stage(vaultInfo.localPath, command.filePaths);
  }
}
