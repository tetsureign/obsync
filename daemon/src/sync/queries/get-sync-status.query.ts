import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SyncQueue } from '@/sync-queue/sync-queue';
import { SyncRepository } from '../sync.repository';
import { SyncStatus } from '../sync.types';
import { forwardRef, Inject } from '@nestjs/common';
import { VaultRepository } from '@/vault/vault.repository';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';

export class GetSyncStatusQuery {
  constructor(
    public readonly vaultName: string,
    public readonly recentSyncLimit = 5,
  ) {}
}

@QueryHandler(GetSyncStatusQuery)
export class GetSyncStatusHandler implements IQueryHandler<GetSyncStatusQuery> {
  constructor(
    private syncQueue: SyncQueue,
    private syncRepository: SyncRepository,
    @Inject(forwardRef(() => VaultRepository))
    private vaultRepository: VaultRepository,
  ) {}

  async execute(query: GetSyncStatusQuery): Promise<SyncStatus> {
    const vault = await this.vaultRepository.findByName(query.vaultName);

    if (!vault) {
      throw new VaultNotFoundError(query.vaultName);
    }

    const activeOperation =
      await this.syncRepository.getActiveSyncOperationByVaultName(
        query.vaultName,
      );

    const recentOperations =
      await this.syncRepository.getRecentCompletedSyncOperationsByVaultName(
        query.vaultName,
        query.recentSyncLimit,
      );

    const runtime = this.syncQueue.getVaultQueueStatus(query.vaultName);

    return { activeOperation, recentOperations, runtime };
  }
}
