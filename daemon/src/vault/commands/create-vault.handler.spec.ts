// This file is kept for now for historical reason
// I'm not gonna write more unit tests like this. This is kept as a reference instead
// You end up mocking everything anyway, which makes the test not really useful
// I'll write more integration tests instead

import { CreateVaultCommand, CreateVaultHandler } from './create-vault.command';
import { Test, TestingModule } from '@nestjs/testing';
import { VaultRepository } from '../vault.repository';
import { CqrsModule } from '@nestjs/cqrs';

const mockVaultRepository = {
  create: vi.fn(),
};

describe('CreateVaultHandler', () => {
  let handler: CreateVaultHandler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [CqrsModule],
      providers: [
        CreateVaultHandler,
        {
          provide: VaultRepository,
          useValue: mockVaultRepository,
        },
      ],
    }).compile();

    handler = module.get<CreateVaultHandler>(CreateVaultHandler);
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should create a vault', async () => {
    const expected = {
      id: 'abc-123',
      name: 'work',
      localPath: '/home/user/vaults/work',
      remote: 'git@github.com:you/work.git',
    };

    mockVaultRepository.create.mockResolvedValue(expected);

    const result = await handler.execute(
      new CreateVaultCommand(
        'work',
        '/home/user/vaults/work',
        'git@github.com:you/work.git',
      ),
    );

    expect(mockVaultRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'work',
        localPath: '/home/user/vaults/work',
      }),
    );

    expect(result).toEqual(expected);
  });

  it('should throw an error if vault already exists', async () => {
    const error = new Error('Unique constraint failed');
    error.cause = {
      extendedCode: 'SQLITE_CONSTRAINT_UNIQUE',
    };

    mockVaultRepository.create.mockRejectedValue(error);

    await expect(
      handler.execute(
        new CreateVaultCommand(
          'work',
          '/home/user/vaults/work',
          'git@github.com:you/work.git',
        ),
      ),
    ).rejects.toThrow('Unique constraint failed');
  });
});
