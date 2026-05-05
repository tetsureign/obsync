import { Database } from '@/database/database';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { syncRecords } from '@/database/schema';
import { NewSyncRecord } from './sync.types';

@Injectable()
export class SyncRepository {
  constructor(private readonly database: Database) {}

  async findAll() {
    return await this.database.db.select().from(syncRecords);
  }

  async findById(id: string) {
    return await this.database.db
      .select()
      .from(syncRecords)
      .where(eq(syncRecords.id, id))
      .limit(1)
      .get();
  }

  async create(data: NewSyncRecord) {
    return await this.database.db
      .insert(syncRecords)
      .values(data)
      .returning()
      .get();
  }

  async updateById(id: string, data: Partial<NewSyncRecord>) {
    return await this.database.db
      .update(syncRecords)
      .set(data)
      .where(eq(syncRecords.id, id))
      .returning()
      .get();
  }

  async delete(id: string) {
    const result = await this.database.db
      .delete(syncRecords)
      .where(eq(syncRecords.id, id))
      .run();

    return result.rowsAffected > 0;
  }
}
