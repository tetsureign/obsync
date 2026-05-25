import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SyncRepository } from './sync/sync.repository';
import { AbortingAllSyncOnBootstrapError } from './common/errors/aborting-all-sync-on-bootstrap.error';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(private syncRepository: SyncRepository) {}

  private logger = new Logger(AppService.name);

  async onApplicationBootstrap() {
    try {
      const result = await this.syncRepository.abortAllActiveSyncOperations();

      if (result.rowsAffected > 0) {
        this.logger.warn(
          `Aborted ${result.rowsAffected} dangling sync operation(s) on application startup.`,
        );
      } else {
        this.logger.log(
          `No dangling sync operations found to abort on application startup.`,
        );
      }
    } catch (error) {
      throw new AbortingAllSyncOnBootstrapError(error);
    }
  }
}
