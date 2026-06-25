import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GitService } from '@/git/git.service';
import { VaultRepository } from '@/vault/vault.repository';
import { forwardRef, Inject } from '@nestjs/common';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { SyncOperation } from '../sync.types';

export class GetGitStatusQuery {
  constructor(public readonly vaultId: SyncOperation['vaultId']) {}
}

@QueryHandler(GetGitStatusQuery)
export class GetGitStatusHandler implements IQueryHandler<GetGitStatusQuery> {
  constructor(
    private readonly gitService: GitService,
    @Inject(forwardRef(() => VaultRepository))
    private readonly vaultRepository: VaultRepository,
  ) {}

  async execute(query: GetGitStatusQuery) {
    const vaultInfo = await this.vaultRepository.findById(query.vaultId);

    if (!vaultInfo) {
      throw new VaultNotFoundError(query.vaultId);
    }

    await this.gitService.assertValidVault(
      vaultInfo.localPath,
      vaultInfo.remote,
    );

    return await this.gitService.getStatus(vaultInfo.localPath);
  }
}
