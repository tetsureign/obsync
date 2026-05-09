import { Database } from '@/database/database';
import { Injectable } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { syncOperations } from '@/database/schema';
import { NewSyncRecord } from './sync.types';

@Injectable()
export class SyncRepository {
  constructor(private readonly database: Database) {}

  async findAll() {
    return await this.database.db.select().from(syncOperations);
  }

  async findById(id: string) {
    return await this.database.db
      .select()
      .from(syncOperations)
      .where(eq(syncOperations.id, id))
      .limit(1)
      .get();
  }

  async create(data: NewSyncRecord) {
    return await this.database.db
      .insert(syncOperations)
      .values(data)
      .returning()
      .get();
  }

  async updateById(id: string, data: Partial<NewSyncRecord>) {
    return await this.database.db
      .update(syncOperations)
      .set(data)
      .where(eq(syncOperations.id, id))
      .returning()
      .get();
  }

  async delete(id: string) {
    const result = await this.database.db
      .delete(syncOperations)
      .where(eq(syncOperations.id, id))
      .run();

    return result.rowsAffected > 0;
  }

  async getSyncHistory(vaultId: string) {
    return await this.database.db
      .select()
      .from(syncOperations)
      .where(eq(syncOperations.vaultId, vaultId))
      .orderBy(asc(syncOperations.updatedAt));
  }
}
