import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/libsql';

@Injectable()
export class Database {
  public readonly db: ReturnType<typeof drizzle>;
  private configurePromise?: Promise<void>;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('DB_FILE_NAME');

    this.db = drizzle({
      connection: { url },
      casing: 'snake_case',
    });
  }

  configure(): Promise<void> {
    this.configurePromise ??= this.db.$client
      .execute('PRAGMA journal_mode = WAL')
      .then(() => undefined);

    return this.configurePromise;
  }
}
