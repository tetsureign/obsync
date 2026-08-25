import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { appPaths } from '../common/utils/app-paths';

@Injectable()
export class Database {
  public readonly db: ReturnType<typeof drizzle>;
  private configurePromise?: Promise<void>;

  constructor(private readonly configService: ConfigService) {
    this.db = drizzle({
      connection: { path: this.resolveDbFilePath() },
    });
  }

  /**
   * DB_FILE_NAME is an optional override; without it the database lives in
   * the platform-appropriate data dir (e.g. ~/.local/share/obsync on Linux,
   * ~/Library/Application Support/obsync on macOS).
   */
  private resolveDbFilePath(): string {
    const configured = this.configService.get<string>('DB_FILE_NAME');
    if (configured) {
      return configured;
    }

    mkdirSync(appPaths.data, { recursive: true });
    return join(appPaths.data, 'obsync.db');
  }

  async configure(): Promise<void> {
    this.configurePromise ??= Promise.resolve().then(() => {
      this.db.$client.exec('PRAGMA journal_mode = WAL');
      this.db.$client.exec('PRAGMA foreign_keys = ON');
    });

    return this.configurePromise;
  }
}
