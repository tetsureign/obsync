/* eslint-disable @typescript-eslint/await-thenable -- Drizzle's node:sqlite adapter exposes sync terminal methods, but repositories keep async boundaries for Nest/service consistency. */
import { Database } from '@/database/database';
import { Injectable } from '@nestjs/common';
import { eq, asc, and, inArray, ne } from 'drizzle-orm';
import { syncOperations, vaults } from '@/database/schema';
import { PartialSyncOperation, SyncOperation } from './sync.types';
import { getSqliteRowsAffected } from '@/database/sqlite-result';

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

  async create(data: PartialSyncOperation) {
    return await this.database.db
      .insert(syncOperations)
      .values(data)
      .returning()
      .get();
  }

  // Might not be needed since we should use specific methods for updating sync operation status/step, but it's here just in case
  private async updateById(id: string, data: Partial<PartialSyncOperation>) {
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

    return getSqliteRowsAffected(result) > 0;
  }

  private vaultIdByNameSubquery(vaultName: string) {
    return this.database.db
      .select({ id: vaults.id })
      .from(vaults)
      .where(eq(vaults.name, vaultName));
  }

  async getSyncHistoryByVaultName(vaultName: string) {
    return await this.database.db
      .select()
      .from(syncOperations)
      .where(
        inArray(syncOperations.vaultId, this.vaultIdByNameSubquery(vaultName)),
      )
      .orderBy(asc(syncOperations.updatedAt));
  }

  async getActiveSyncOperationByVaultName(vaultName: string) {
    return await this.database.db
      .select()
      .from(syncOperations)
      .where(
        and(
          inArray(
            syncOperations.vaultId,
            this.vaultIdByNameSubquery(vaultName),
          ),
          inArray(syncOperations.status, ['queued', 'running']),
        ),
      )
      .limit(1)
      .get();
  }

  async getRecentCompletedSyncOperationsByVaultName(
    vaultName: string,
    limit: number,
  ) {
    return await this.database.db
      .select()
      .from(syncOperations)
      .where(
        and(
          inArray(
            syncOperations.vaultId,
            this.vaultIdByNameSubquery(vaultName),
          ),
          inArray(syncOperations.status, ['aborted', 'failed', 'success']),
        ),
      )
      .limit(limit);
  }

  async abortQueuedSyncOperationByVaultName(vaultName: string) {
    return await this.database.db
      .update(syncOperations)
      .set({ status: 'aborted' })
      .where(
        and(
          inArray(
            syncOperations.vaultId,
            this.vaultIdByNameSubquery(vaultName),
          ),
          inArray(syncOperations.status, ['queued']),
        ),
      );
  }

  // --- id-based methods kept for internal use by the sync job runner ---

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
      .set({ status: 'aborted' })
      .where(
        and(
          eq(syncOperations.vaultId, vaultId),
          inArray(syncOperations.status, ['queued', 'running']),
        ),
      );
  }

  async abortActiveSyncOperationByVaultName(vaultName: string) {
    return await this.database.db
      .update(syncOperations)
      .set({ status: 'aborted' })
      .where(
        and(
          inArray(
            syncOperations.vaultId,
            this.vaultIdByNameSubquery(vaultName),
          ),
          inArray(syncOperations.status, ['queued', 'running']),
        ),
      );
  }

  async abortQueuedSyncOperation(vaultId: string) {
    return await this.database.db
      .update(syncOperations)
      .set({ status: 'aborted' })
      .where(
        and(
          eq(syncOperations.vaultId, vaultId),
          inArray(syncOperations.status, ['queued']),
        ),
      );
  }

  async abortAllActiveSyncOperations() {
    return await this.database.db
      .update(syncOperations)
      .set({ status: 'aborted' })
      .where(inArray(syncOperations.status, ['queued', 'running']));
  }

  async getRecentCompletedSyncOperations(vaultId: string, limit: number) {
    return await this.database.db
      .select()
      .from(syncOperations)
      .where(
        and(
          eq(syncOperations.vaultId, vaultId),
          inArray(syncOperations.status, ['aborted', 'failed', 'success']),
        ),
      )
      .limit(limit);
  }

  async queueSyncOperation(vaultId: string) {
    return await this.create({
      vaultId,
      status: 'queued',
      step: 'pull',
    });
  }

  async startSyncOperationStep(
    id: string,
    step: Exclude<SyncOperation['step'], 'done'>,
  ) {
    const allowedPreviousSteps: Record<
      Exclude<SyncOperation['step'], 'done'>,
      SyncOperation['step'][]
    > = {
      pull: ['pull', 'stage', 'commit', 'push'], // allow re-running pull step in case of failure
      stage: ['pull', 'stage', 'commit', 'push'], // allow re-running stage step in case of failure
      commit: ['stage', 'commit', 'push'], // allow re-running commit step in case of failure, but only if stage step was successful (otherwise we might end up with unstaged changes that will be committed in the next commit attempt, which could be confusing)
      push: ['commit', 'push'], // allow re-running push step in case of failure, but only if commit step was successful (otherwise we might end up with new commits that will be pushed in the next push attempt, which could be confusing)
    };

    return await this.database.db
      .update(syncOperations)
      .set({ status: 'running', step })
      .where(
        and(
          eq(syncOperations.id, id),
          and(
            inArray(syncOperations.status, ['queued', 'running']),
            ne(syncOperations.step, 'done'),
            inArray(syncOperations.step, allowedPreviousSteps[step]),
          ),
        ),
      )
      .returning()
      .get();
  }

  async succeedSyncOperation(
    id: string,
    payload: Pick<SyncOperation, 'commitSha'>,
  ) {
    return await this.database.db
      .update(syncOperations)
      .set({
        status: 'success',
        step: 'done',
        ...payload,
      })
      .where(
        and(eq(syncOperations.id, id), eq(syncOperations.status, 'running')),
      )
      .returning()
      .get();
  }

  async failSyncOperation(
    id: string,
    payload: Pick<SyncOperation, 'error' | 'commitSha'>,
  ) {
    return await this.database.db
      .update(syncOperations)
      .set({
        status: 'failed',
        ...payload,
      })
      .where(
        and(
          eq(syncOperations.id, id),
          inArray(syncOperations.status, ['queued', 'running']),
        ),
      )
      .returning()
      .get();
  }
}
