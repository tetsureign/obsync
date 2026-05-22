import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { SyncRepository } from './sync/sync.repository';
import { AbortingAllSyncOperationsError } from './common/errors/aborting-all-sync.error';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(private syncRepository: SyncRepository) {}

  async onApplicationBootstrap() {
    try {
      return await this.syncRepository.abortAllActiveSyncOperations();
    } catch (queryError) {
      throw new AbortingAllSyncOperationsError(queryError);
    }
  }
}
