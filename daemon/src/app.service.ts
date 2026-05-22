import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SyncRepository } from './sync/sync.repository';
import { AbortingAllSyncOperationsError } from './common/errors/aborting-all-sync.error';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(private syncRepository: SyncRepository) {}

  private logger = new Logger(AppService.name);

  async onApplicationBootstrap() {
    try {
      const result = await this.syncRepository.abortAllActiveSyncOperations();

      if (result.rowsAffected > 0) {
        this.logger.warn(
          `Aborted ${result.rowsAffected} active sync operation(s) on application startup.`,
        );
      } else {
        this.logger.log(
          `No active sync operations found to abort on application startup.`,
        );
      }
    } catch (error) {
      throw new AbortingAllSyncOperationsError(error);
    }
  }
}
