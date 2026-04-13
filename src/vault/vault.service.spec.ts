import { Test, TestingModule } from '@nestjs/testing';
import { VaultService } from './vault.service';
import { Database } from '../database/database';
import { vaults } from '../drizzle/schema';

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
              insert: jest.fn().mockReturnValue({ values: jest.fn() }),
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

  it('should create a vault', async () => {
    const id = 'test-vault-id';
    await service.create(id);
    // Here you would typically check if the vault was created in the database
    // For example, you could mock the database and verify that the insert method was called with the correct parameters

    expect(service['database'].db.insert).toHaveBeenCalledWith(vaults);
  });
});
