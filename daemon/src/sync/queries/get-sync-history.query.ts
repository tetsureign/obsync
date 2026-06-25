import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SyncRepository } from '../sync.repository';
import { SyncOperation } from '../sync.types';

export class GetSyncHistoryQuery {
  constructor(public readonly vaultId: SyncOperation['vaultId']) {}
}

@QueryHandler(GetSyncHistoryQuery)
export class GetSyncHistoryHandler implements IQueryHandler<GetSyncHistoryQuery> {
  constructor(private readonly syncRepository: SyncRepository) {}

  async execute(query: GetSyncHistoryQuery) {
    return await this.syncRepository.getSyncHistory(query.vaultId);
  }
}
