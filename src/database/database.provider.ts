import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/libsql';
import { DB } from './database.constants';

export const databaseProvider = {
  provide: DB,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const url = configService.getOrThrow<string>('DB_FILE_NAME');

    return drizzle({
      connection: { url },
    });
  },
};
