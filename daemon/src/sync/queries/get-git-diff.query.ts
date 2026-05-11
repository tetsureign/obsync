import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GitService } from '@/git/git.service';
import { forwardRef, Inject } from '@nestjs/common';
import { VaultRepository } from '@/vault/vault.repository';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';

export class GetGitDiffQuery {
  constructor(
    public readonly vaultId: string,
    public readonly filePaths: string[],
  ) {}
}

@QueryHandler(GetGitDiffQuery)
export class GetGitDiffHandler implements IQueryHandler<GetGitDiffQuery> {
  constructor(
    private readonly gitService: GitService,
    @Inject(forwardRef(() => VaultRepository))
    private readonly vaultRepository: VaultRepository,
  ) {}

  async execute(query: GetGitDiffQuery) {
    const vaultInfo = await this.vaultRepository.findById(query.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(query.vaultId);
    }

    await this.gitService.assertValidVault(
      vaultInfo.localPath,
      vaultInfo.remote,
    );

    return this.gitService.diff(query.vaultId, query.filePaths);
  }
}
