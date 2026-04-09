import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DB } from './database.constants';
import { databaseProvider } from './database.provider';
import { drizzle } from 'drizzle-orm/libsql';

describe('databaseProvider', () => {
  let db: typeof drizzle;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        databaseProvider,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'DB_FILE_NAME') return 'file:test.db';
              throw new Error(`Missing config: ${key}`);
            },
          },
        },
      ],
    }).compile();

    db = module.get<typeof drizzle>(DB);
  });

  it('should be defined', () => {
    expect(db).toBeDefined();
  });
});
