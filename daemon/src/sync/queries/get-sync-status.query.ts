import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SyncQueue } from '@/sync-queue/sync-queue';
import { SyncRepository } from '../sync.repository';
import { SyncStatus } from '../sync.types';

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
  ) {}

  async execute(query: GetSyncStatusQuery): Promise<SyncStatus> {
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
