import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { VaultNotFoundError } from '../errors/vault-not-found.error';

export class GetVaultQuery {
  constructor(public readonly name: string) {}
}

@QueryHandler(GetVaultQuery)
export class GetVaultHandler implements IQueryHandler<GetVaultQuery> {
  constructor(private readonly vaultRepository: VaultRepository) {}

  async execute(query: GetVaultQuery) {
    const vault = await this.vaultRepository.findByName(query.name);

    if (!vault) {
      throw new VaultNotFoundError(query.name);
    }
    return vault;
  }
}
