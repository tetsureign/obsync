import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { SyncRepository } from './sync/sync.repository';
import { AbortingAllSyncOnBootstrapError } from './common/errors/aborting-all-sync-on-bootstrap.error';
import { getSqliteRowsAffected } from './database/sqlite-result';
import { appPaths } from './common/utils/app-paths';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import crypto from 'crypto';
import { z } from 'zod';

const LockfileSchema = z.object({
  token: z.string(),
  pid: z.number(),
});

@Injectable()
export class AppService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(private syncRepository: SyncRepository) {}

  private readonly logger = new Logger(AppService.name);
  private readonly lockfileName = '/daemon.json';
  private token = '';

  async onApplicationBootstrap() {
    await this.abortStaleSyncOperations();
    await this.writeLockfile();
  }

  async onApplicationShutdown(signal: string) {
    await this.removeLockfile();
    this.logger.log(`Application is shutting down due to signal: ${signal}`);
  }

  private async abortStaleSyncOperations() {
    try {
      const result = await this.syncRepository.abortAllActiveSyncOperations();
      const abortedCount = getSqliteRowsAffected(result);

      if (abortedCount > 0) {
        this.logger.warn(
          `Aborted ${abortedCount} dangling sync operation(s) on application startup.`,
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

  private async writeLockfile() {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      this.token = token;

      await mkdir(appPaths.config, {
        recursive: true,
      });

      await writeFile(
        appPaths.config + this.lockfileName,
        JSON.stringify({
          token,
          pid: process.pid,
        }),
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to write lockfile at ${appPaths.config + this.lockfileName}: ${error.message}`,
        );
      } else {
        this.logger.error(
          `Failed to write lockfile at ${appPaths.config + this.lockfileName}`,
        );
      }
    }
  }

  private async readLockfile() {
    const lockfileContent = await readFile(
      appPaths.config + this.lockfileName,
      'utf8',
    );
    return LockfileSchema.parse(JSON.parse(lockfileContent));
  }

  private async removeLockfile() {
    return await unlink(appPaths.config + this.lockfileName);
  }

  public isValidToken(token: string): boolean {
    return token === this.token;
  }
}
