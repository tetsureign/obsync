import { Test, TestingModule } from '@nestjs/testing';
import { vi } from 'vitest';
import { VaultService } from './vault.service';
import { Database } from '@/database/database';

describe('VaultService', () => {
  let service: VaultService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VaultService,
        {
          provide: Database,
          useValue: {
            db: {
              insert: vi.fn().mockReturnValue({ values: vi.fn() }),
            },
          },
        },
      ],
    }).compile();

    service = module.get<VaultService>(VaultService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
