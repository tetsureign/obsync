import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-sqlite';

@Injectable()
export class Database {
  public readonly db: ReturnType<typeof drizzle>;
  private configurePromise?: Promise<void>;

  constructor(private readonly configService: ConfigService) {
    const dbFileName = this.configService.getOrThrow<string>('DB_FILE_NAME');

    this.db = drizzle({
      connection: { path: dbFileName },
    });
  }

  async configure(): Promise<void> {
    this.configurePromise ??= Promise.resolve().then(() => {
      this.db.$client.exec('PRAGMA journal_mode = WAL');
      this.db.$client.exec('PRAGMA foreign_keys = ON');
    });

    return this.configurePromise;
  }
}
