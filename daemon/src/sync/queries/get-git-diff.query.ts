import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GitService } from '@/git/git.service';
import { forwardRef, Inject } from '@nestjs/common';
import { VaultRepository } from '@/vault/vault.repository';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';
import { SyncOperationStillRunningError } from '../error/sync-still-running.error';
import { SyncRepository } from '../sync.repository';

export class GetGitDiffQuery {
  constructor(
    public readonly vaultName: string,
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
    const vaultInfo = await this.vaultRepository.findByName(query.vaultName);

    if (!vaultInfo) {
      throw new VaultNotFoundError(query.vaultName);
    }

    await this.gitService.validateVaultGitRepo(vaultInfo.localPath);
    await this.gitService.getEffectiveRemote(vaultInfo.localPath);

    if (await this.syncRepository.getActiveSyncOperation(vaultInfo.id)) {
      throw new SyncOperationStillRunningError(query.vaultName, 'diff');
    }

    return this.gitService.diff(vaultInfo.localPath, query.options);
  }
}
