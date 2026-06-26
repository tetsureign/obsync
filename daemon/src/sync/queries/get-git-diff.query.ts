import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GitService } from '@/git/git.service';
import { forwardRef, Inject } from '@nestjs/common';
import { VaultRepository } from '@/vault/vault.repository';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { SyncOperation } from '../sync.types';
import { SyncOperationStillRunningError } from '../error/sync-still-running.error';
import { SyncRepository } from '../sync.repository';

export class GetGitDiffQuery {
  constructor(
    public readonly vaultId: SyncOperation['vaultId'],
    public readonly options: string[] | undefined,
  ) {}
}

@QueryHandler(GetGitDiffQuery)
export class GetGitDiffHandler implements IQueryHandler<GetGitDiffQuery> {
  constructor(
    private readonly gitService: GitService,
    @Inject(forwardRef(() => VaultRepository))
    private readonly vaultRepository: VaultRepository,
    private readonly syncRepository: SyncRepository,
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

    if (await this.syncRepository.getActiveSyncOperation(query.vaultId)) {
      throw new SyncOperationStillRunningError(query.vaultId, 'diff');
    }

    return this.gitService.diff(vaultInfo.localPath, query.options);
  }
}
