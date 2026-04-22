import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { VaultController } from './vault.controller';

describe('VaultController', () => {
  let controller: VaultController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VaultController],
      providers: [
        {
          provide: CommandBus,
          useValue: { execute: vi.fn() },
        },
        {
          provide: QueryBus,
          useValue: { execute: vi.fn() },
        },
      ],
    }).compile();

    controller = module.get<VaultController>(VaultController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
