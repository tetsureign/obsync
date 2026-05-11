import { Database } from '@/database/database';
import { Injectable } from '@nestjs/common';
import { eq, asc, and, inArray } from 'drizzle-orm';
import { syncOperations } from '@/database/schema';
import { NewSyncOperation, SyncOperation } from './sync.types';

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

  async create(data: NewSyncOperation) {
    return await this.database.db
      .insert(syncOperations)
      .values(data)
      .returning()
      .get();
  }

  async updateById(id: string, data: Partial<NewSyncOperation>) {
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

  async getActiveSyncOperation(vaultId: string) {
    return await this.database.db
      .select()
      .from(syncOperations)
      .where(
        and(
          eq(syncOperations.vaultId, vaultId),
          inArray(syncOperations.status, ['queued', 'running']),
        ),
      )
      .limit(1)
      .get();
  }

  async getAllActiveSyncOperations() {
    return await this.database.db
      .select()
      .from(syncOperations)
      .where(inArray(syncOperations.status, ['queued', 'running']));
  }

  async abortActiveSyncOperation(vaultId: string) {
    const activeOperation = await this.getActiveSyncOperation(vaultId);

    if (!activeOperation) {
      return null;
    }

    return await this.updateById(activeOperation.id, {
      status: 'aborted',
      step: 'done',
    });
  }
}
