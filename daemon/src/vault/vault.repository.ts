import { Injectable } from '@nestjs/common';

import { Database } from '@/database/database';
import { vaults } from '@/database/schema';
import { eq, type InferInsertModel } from 'drizzle-orm';

type NewVault = InferInsertModel<typeof vaults>;

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

  async create(data: NewVault) {
    const [created] = await this.database.db
      .insert(vaults)
      .values(data)
      .returning();
    return created;
  }
}
