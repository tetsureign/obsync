/* eslint-disable @typescript-eslint/await-thenable -- Drizzle's node:sqlite adapter exposes sync terminal methods, but repositories keep async boundaries for Nest/service consistency. */
import { Injectable } from '@nestjs/common';

import { Database } from '@/database/database';
import { syncOperations, vaults } from '@/database/schema';
import { eq, inArray, and, notExists } from 'drizzle-orm';
import { PartialVault } from './vault.types';
import { VaultNotFoundError } from './errors/vault-not-found.error';
import { SyncOperationIsRunningError } from './errors/sync-operation-running.error';
import { getSqliteRowsAffected } from '@/database/sqlite-result';

@Injectable()
export class VaultRepository {
  constructor(private readonly database: Database) {}

  private getActiveSyncSubquery(vaultId: string) {
    return this.database.db
      .select({ id: syncOperations.id })
      .from(syncOperations)
      .where(
        and(
          eq(syncOperations.vaultId, vaultId),
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

  async updateById(id: string, data: Partial<PartialVault>) {
    const updatedVault = await this.database.db
      .update(vaults)
      .set(data)
      .where(and(eq(vaults.id, id), notExists(this.getActiveSyncSubquery(id))))
      .returning()
      .get();

    if (updatedVault) {
      return updatedVault;
    }

    // Check if vault still exists after edit if the command didn't successfully run
    const existingVault = await this.findById(id);
    if (!existingVault) {
      throw new VaultNotFoundError(id);
    }

    // If not that, then the only option is sync operation is running for this vault
    throw new SyncOperationIsRunningError(id);
  }

  async delete(id: string) {
    const result = await this.database.db
      .delete(vaults)
      .where(and(eq(vaults.id, id), notExists(this.getActiveSyncSubquery(id))))
      .run();

    if (getSqliteRowsAffected(result) > 0) {
      return true;
    }

    const existingVault = await this.findById(id);
    if (!existingVault) {
      throw new VaultNotFoundError(id);
    }

    throw new SyncOperationIsRunningError(id);
  }
}
