import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SyncRepository } from '../sync.repository';
import { forwardRef, Inject } from '@nestjs/common';
import { VaultRepository } from '@/vault/vault.repository';
import { VaultNotFoundError } from '@/vault/errors/vault-not-found.error';

export class GetSyncHistoryQuery {
  constructor(public readonly vaultName: string) {}
}

@QueryHandler(GetSyncHistoryQuery)
export class GetSyncHistoryHandler implements IQueryHandler<GetSyncHistoryQuery> {
  constructor(
    private readonly syncRepository: SyncRepository,
    @Inject(forwardRef(() => VaultRepository))
    private readonly vaultRepository: VaultRepository,
  ) {}

  async execute(query: GetSyncHistoryQuery) {
    const vault = await this.vaultRepository.findByName(query.vaultName);

    if (!vault) {
      throw new VaultNotFoundError(query.vaultName);
    }

    return await this.syncRepository.getSyncHistoryByVaultName(query.vaultName);
  }
}
