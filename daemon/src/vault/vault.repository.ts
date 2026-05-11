import { Injectable } from '@nestjs/common';

import { Database } from '@/database/database';
import { syncOperations, vaults } from '@/database/schema';
import { eq, inArray, and, notExists } from 'drizzle-orm';
import { NewVault } from './vault.types';
import { VaultNotFoundError } from './errors/vault-not-found.error';
import { SyncOperationIsRunningError } from './errors/sync-operation-running.error';

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

  async create(data: NewVault) {
    return await this.database.db.insert(vaults).values(data).returning().get();
  }

  async updateById(id: string, data: Partial<NewVault>) {
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

    if (result.rowsAffected > 0) {
      return true;
    }

    const existingVault = await this.findById(id);
    if (!existingVault) {
      throw new VaultNotFoundError(id);
    }

    throw new SyncOperationIsRunningError(id);
  }
}
