import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Database } from './database';

describe('Database', () => {
  let provider: Database;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [Database],
    }).compile();

    provider = module.get<Database>(Database);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });
});
