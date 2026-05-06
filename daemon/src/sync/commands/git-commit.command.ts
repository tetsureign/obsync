import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SyncRecordPayload } from '../sync.types';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { VaultRepository } from '@/vault/vault.repository';
import { GitService } from '@/git/git.service';

export class GitCommitCommand {
  constructor(
    public readonly vaultId: SyncRecordPayload['vaultId'],
    public readonly commitMessage: string = `auto commit at ${new Date().toISOString()}`,
  ) {}
}

@CommandHandler(GitCommitCommand)
export class GitCommitHandler implements ICommandHandler<GitCommitCommand> {
  constructor(
    private vaultRepository: VaultRepository,
    private gitService: GitService,
  ) {}

  async execute(command: GitCommitCommand) {
    const vaultInfo = await this.vaultRepository.findById(command.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(command.vaultId);
    }

    await this.gitService.assertValidVault(
      vaultInfo.localPath,
      vaultInfo.remote,
    );

    await this.gitService.commit(vaultInfo.localPath, command.commitMessage);
  }
}
