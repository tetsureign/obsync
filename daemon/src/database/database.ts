import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/libsql';

@Injectable()
export class Database {
  public readonly db: ReturnType<typeof drizzle>;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.getOrThrow<string>('DB_FILE_NAME');

    this.db = drizzle({
      connection: { url },
    });
  }
}
