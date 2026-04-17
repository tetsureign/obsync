import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';
import { NotFoundException } from '@nestjs/common';

export class GetVaultQuery {
  constructor(public readonly id: string) {}
}

@QueryHandler(GetVaultQuery)
export class GetVaultHandler implements IQueryHandler<GetVaultQuery> {
  constructor(private readonly vaultRepository: VaultRepository) {}

  async execute(query: GetVaultQuery) {
    const vault = await this.vaultRepository.findById(query.id);
    if (!vault) {
      throw new NotFoundException('Vault not found');
    }
    return vault;
  }
}
