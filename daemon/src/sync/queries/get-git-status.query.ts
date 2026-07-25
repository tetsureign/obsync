import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GitService } from '@/git/git.service';
import { VaultRepository } from '@/vault/vault.repository';
import { forwardRef, Inject } from '@nestjs/common';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';

export class GetGitStatusQuery {
  constructor(public readonly vaultName: string) {}
}

@QueryHandler(GetGitStatusQuery)
export class GetGitStatusHandler implements IQueryHandler<GetGitStatusQuery> {
  constructor(
    private readonly gitService: GitService,
    @Inject(forwardRef(() => VaultRepository))
    private readonly vaultRepository: VaultRepository,
  ) {}

  async execute(query: GetGitStatusQuery) {
    const vaultInfo = await this.vaultRepository.findByName(query.vaultName);

    if (!vaultInfo) {
      throw new VaultNotFoundError(query.vaultName);
    }

    await this.gitService.validateVaultGitRepo(vaultInfo.localPath);
    await this.gitService.getEffectiveRemote(vaultInfo.localPath);

    return await this.gitService.getStatus(vaultInfo.localPath);
  }
}
