import { vaults } from '@/database/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type NewVault = InferInsertModel<typeof vaults>;
export type Vault = InferSelectModel<typeof vaults>;

export type VaultPayload = Pick<
  NewVault,
  | 'name'
  | 'localPath'
  | 'remote'
  | 'branch'
  | 'autoSync'
  | 'syncInterval'
  | 'conflictStrategy'
>;

export type UpdateVaultPayload = Partial<VaultPayload> & { id: string };
