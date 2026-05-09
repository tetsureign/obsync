import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRecordPayload } from '../sync.types';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';
import { currentInstantIso } from '@/common/utils/temporal';
import { forwardRef, Inject } from '@nestjs/common';

export class CommitVaultCommand {
  constructor(
    public readonly vaultId: SyncRecordPayload['vaultId'],
    public readonly commitMessage: string = `auto commit at ${currentInstantIso()}`,
  ) {}
}

@CommandHandler(CommitVaultCommand)
export class CommitVaultHandler implements ICommandHandler<CommitVaultCommand> {
  constructor(
    @Inject(forwardRef(() => VaultRepository))
    private vaultRepository: VaultRepository,
    private gitService: GitService,
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

    return await this.gitService.commit(
      vaultInfo.localPath,
      command.commitMessage,
    );
  }
}
