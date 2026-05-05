import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { VaultNotFoundError } from '../errors/vault-not-found.error';

export class GetVaultByPathQuery {
  constructor(public readonly path: string) {}
}

@QueryHandler(GetVaultByPathQuery)
export class GetVaultByPathHandler implements IQueryHandler<GetVaultByPathQuery> {
  constructor(private readonly vaultRepository: VaultRepository) {}

  async execute(query: GetVaultByPathQuery) {
    const vault = await this.vaultRepository.findByPath(query.path);

    if (!vault) {
      throw new VaultNotFoundError(query.path);
    }
    return vault;
  }
}
