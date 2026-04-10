import { Database } from '@/database/database';
import { Injectable } from '@nestjs/common';
import { vaults } from '$/drizzle/schema';

@Injectable()
export class VaultService {
  constructor(private readonly database: Database) {}

  async create(id: string) {
    await this.database.db.insert(vaults).values({ id });
  }
}
