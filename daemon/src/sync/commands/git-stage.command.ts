import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRecordPayload } from '../sync.types';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';

export class GitStageCommand {
  constructor(
    public readonly vaultId: SyncRecordPayload['vaultId'],
    public readonly filePaths: string[],
  ) {}
}

@CommandHandler(GitStageCommand)
export class GitStageHandler implements ICommandHandler<GitStageCommand> {
  constructor(
    private vaultRepository: VaultRepository,
    private gitService: GitService,
  ) {}

  async execute(command: GitStageCommand) {
    const vaultInfo = await this.vaultRepository.findById(command.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultId);
    }

    await this.gitService.assertValidVault(
      vaultInfo.localPath,
      vaultInfo.remote,
    );

    await this.gitService.stage(vaultInfo.localPath, command.filePaths);
  }
}
