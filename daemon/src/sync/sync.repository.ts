import { Database } from '@/database/database';
import { Injectable } from '@nestjs/common';
import { eq, asc, and, inArray, ne } from 'drizzle-orm';
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

  // Might not be needed since we should use specific methods for updating sync operation status/step, but it's here just in case
  private async updateById(id: string, data: Partial<NewSyncOperation>) {
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
    return await this.database.db
      .update(syncOperations)
      .set({ status: 'aborted', step: 'done' })
      .where(
        and(
          eq(syncOperations.vaultId, vaultId),
          inArray(syncOperations.status, ['queued', 'running']),
        ),
      )
      .returning()
      .get();
  }

  async abortAllActiveSyncOperations() {
    return await this.database.db
      .update(syncOperations)
      .set({ status: 'aborted', step: 'done' })
      .where(inArray(syncOperations.status, ['queued', 'running']))
      .returning();
  }

  async queueSyncOperation(vaultId: string) {
    return await this.create({
      vaultId,
      status: 'queued',
      step: 'pull',
    });
  }

  async runSyncOperation(
    id: string,
    step: Exclude<SyncOperation['step'], 'done'>,
  ) {
    return await this.database.db
      .update(syncOperations)
      .set({ status: 'running', step })
      .where(
        and(
          eq(syncOperations.id, id),
          and(
            inArray(syncOperations.status, ['queued', 'running']),
            ne(syncOperations.step, 'done'),
          ),
        ),
      )
      .returning()
      .get();
  }

  async completeSyncOperation(
    id: string,
    payload: Pick<NewSyncOperation, 'error' | 'commitSha'>,
  ) {
    return await this.database.db
      .update(syncOperations)
      .set({
        status: payload.error ? 'failed' : 'success',
        step: 'done',
        ...payload,
      })
      .where(
        and(eq(syncOperations.id, id), eq(syncOperations.status, 'running')),
      )
      .returning()
      .get();
  }
}
