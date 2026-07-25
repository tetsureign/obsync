/* eslint-disable @typescript-eslint/await-thenable -- Drizzle's node:sqlite adapter exposes sync terminal methods, but repositories keep async boundaries for Nest/service consistency. */
import { Injectable } from '@nestjs/common';

import { Database } from '@/database/database';
import { syncOperations, vaults } from '@/database/schema';
import { eq, inArray, and, notExists } from 'drizzle-orm';
import { PartialVault, VaultPayload } from './vault.types';
import { VaultNotFoundError } from './errors/vault-not-found.error';
import { SyncOperationIsRunningError } from './errors/sync-operation-running.error';
import { getSqliteRowsAffected } from '@/database/sqlite-result';

@Injectable()
export class VaultRepository {
  constructor(private readonly database: Database) {}

  /**
   * Correlated subquery: matches active sync_operations rows where
   * vault_id = vaults.id of the outer row being updated/deleted.
   * No pre-fetched id needed — SQLite resolves the column reference at
   * execution time, keeping the entire operation atomic.
   */
  private getActiveSyncCorrelatedSubquery() {
    return this.database.db
      .select({ id: syncOperations.id })
      .from(syncOperations)
      .where(
        and(
          eq(syncOperations.vaultId, vaults.id),
          inArray(syncOperations.status, ['queued', 'running']),
        ),
      );
  }

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

  async findByName(name: string) {
    return await this.database.db
      .select()
      .from(vaults)
      .where(eq(vaults.name, name))
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

  async create(data: PartialVault) {
    return await this.database.db.insert(vaults).values(data).returning().get();
  }

  async updateByName(name: string, data: Partial<VaultPayload>) {
    const updatedVault = await this.database.db
      .update(vaults)
      .set(data)
      .where(
        and(
          eq(vaults.name, name),
          notExists(this.getActiveSyncCorrelatedSubquery()),
        ),
      )
      .returning()
      .get();

    if (updatedVault) {
      return updatedVault;
    }

    // Diagnose only on failure: distinguish not-found from sync-running
    const existing = await this.findByName(name);
    if (!existing) {
      throw new VaultNotFoundError(name);
    }
    throw new SyncOperationIsRunningError(name);
  }

  async deleteByName(name: string) {
    const result = await this.database.db
      .delete(vaults)
      .where(
        and(
          eq(vaults.name, name),
          notExists(this.getActiveSyncCorrelatedSubquery()),
        ),
      )
      .run();

    if (getSqliteRowsAffected(result) > 0) {
      return true;
    }

    // Diagnose only on failure: distinguish not-found from sync-running
    const existing = await this.findByName(name);
    if (!existing) {
      throw new VaultNotFoundError(name);
    }
    throw new SyncOperationIsRunningError(name);
  }
}
