import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { SyncRepository } from './sync/sync.repository';
import { FailedAbortingAllSyncOperations } from './common/errors/failed-aborting-all-sync.error';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(private syncRepository: SyncRepository) {}

  async onApplicationBootstrap() {
    try {
      return await this.syncRepository.abortAllActiveSyncOperations();
    } catch (queryError) {
      throw new FailedAbortingAllSyncOperations(queryError);
    }
  }
}
