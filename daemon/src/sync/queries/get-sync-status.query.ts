import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SyncQueue } from '@/sync-queue/sync-queue';
import { SyncRepository } from '../sync.repository';
import { SyncOperation, SyncStatus } from '../sync.types';

export class GetSyncStatusQuery {
  constructor(
    public readonly vaultId: SyncOperation['vaultId'],
    public readonly lastNCompleted = 5,
  ) {}
}

@QueryHandler(GetSyncStatusQuery)
export class GetSyncStatusHandler implements IQueryHandler<GetSyncStatusQuery> {
  constructor(
    private syncQueue: SyncQueue,
    private syncRepository: SyncRepository,
  ) {}

  async execute(query: GetSyncStatusQuery): Promise<SyncStatus> {
    const activeOperation = await this.syncRepository.getActiveSyncOperation(
      query.vaultId,
    );

    const recentOperations =
      await this.syncRepository.getRecentCompletedSyncOperations(
        query.vaultId,
        query.lastNCompleted,
      );

    const runtime = this.syncQueue.getVaultQueueStatus(query.vaultId);

    return { activeOperation, recentOperations, runtime };
  }
}
