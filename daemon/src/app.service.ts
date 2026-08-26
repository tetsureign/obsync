import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncRepository } from './sync/sync.repository';
import { AbortingAllSyncOnBootstrapError } from './common/errors/aborting-all-sync-on-bootstrap.error';
import { getSqliteRowsAffected } from './database/sqlite-result';
import { appDataDir } from './common/utils/app-paths';
import { daemonLockfilePath } from './common/utils/daemon-lockfile';
import { writeFile, mkdir, readFile, unlink } from 'fs/promises';
import crypto from 'crypto';
import { z } from 'zod';

const DEFAULT_PORT = 7274;

const LockfileSchema = z.object({
  token: z.string(),
  pid: z.number(),
  port: z.number(),
});

@Injectable()
export class AppService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  constructor(
    private syncRepository: SyncRepository,
    private configService: ConfigService,
  ) {}

  private readonly logger = new Logger(AppService.name);
  private token = '';

  async onApplicationBootstrap() {
    await this.abortStaleSyncOperations();
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

  public async writeLockfile() {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      this.token = token;

      const port = this.configService.get<number>('PORT') ?? DEFAULT_PORT;

      await mkdir(appDataDir, {
        recursive: true,
      });

      await writeFile(
        daemonLockfilePath(),
        JSON.stringify({
          token,
          pid: process.pid,
          port,
        }),
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to write lockfile at ${daemonLockfilePath()}: ${error.message}`,
        );
      } else {
        this.logger.error(
          `Failed to write lockfile at ${daemonLockfilePath()}`,
        );
      }
    }
  }

  private async readLockfile() {
    const lockfileContent = await readFile(daemonLockfilePath(), 'utf8');
    return LockfileSchema.parse(JSON.parse(lockfileContent));
  }

  private async removeLockfile() {
    return await unlink(daemonLockfilePath()).catch((error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    });
  }

  public get authToken(): string {
    return this.token;
  }

  public isValidToken(token: string): boolean {
    return token === this.token;
  }
}
