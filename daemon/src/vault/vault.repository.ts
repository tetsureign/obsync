import { Injectable } from '@nestjs/common';

import { Database } from '@/database/database';
import { vaults } from '@/database/schema';
import { eq } from 'drizzle-orm';
import { NewVault } from './vault.types';

@Injectable()
export class VaultRepository {
  constructor(private readonly database: Database) {}

  async findAll() {
    return await this.database.db.select().from(vaults);
  }

  async findById(id: string) {
    return await this.database.db
      .select()
      .from(vaults)
      .where(eq(vaults.id, id))
      .limit(1)
      .get();
  }

  async findByPath(path: string) {
    return await this.database.db
      .select()
      .from(vaults)
      .where(eq(vaults.localPath, path))
      .limit(1)
      .get();
  }

  async create(data: NewVault) {
    return await this.database.db.insert(vaults).values(data).returning().get();
  }

  async updateById(id: string, data: Partial<NewVault>) {
    return await this.database.db
      .update(vaults)
      .set(data)
      .where(eq(vaults.id, id))
      .returning()
      .get();
  }

  async delete(id: string) {
    const result = await this.database.db
      .delete(vaults)
      .where(eq(vaults.id, id))
      .run();

    return result.rowsAffected > 0;
  }
}
