import { vaults } from '@/database/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type PartialVault = InferInsertModel<typeof vaults>;
export type Vault = InferSelectModel<typeof vaults>;

export type VaultPayload = Pick<
  PartialVault,
  'name' | 'localPath' | 'autoSync' | 'syncInterval' | 'conflictStrategy'
>;

export type UpdateVaultPayload = Partial<VaultPayload> & { id: string };
