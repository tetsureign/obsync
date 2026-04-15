import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { VaultRepository } from '../vault.repository';

export class ListVaultsQuery {
  constructor() {}
}

@QueryHandler(ListVaultsQuery)
export class ListVaultsHandler implements IQueryHandler<ListVaultsQuery> {
  constructor(private readonly vaultRepository: VaultRepository) {}

  async execute() {
    return await this.vaultRepository.findAll();
  }
}
