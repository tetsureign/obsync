import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRecordPayload } from '../sync.types';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';

export class GitPushCommand {
  constructor(public readonly vaultId: SyncRecordPayload['vaultId']) {}
}

@CommandHandler(GitPushCommand)
export class GitPushHandler implements ICommandHandler<GitPushCommand> {
  constructor(
    private vaultRepository: VaultRepository,
    private gitService: GitService,
  ) {}

  async execute(command: GitPushCommand) {
    const vaultInfo = await this.vaultRepository.findById(command.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultId);
    }

    await this.gitService.assertValidVault(
      vaultInfo.localPath,
      vaultInfo.remote,
    );

    await this.gitService.push(vaultInfo.localPath);
  }
}
