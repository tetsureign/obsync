import { syncOperations } from '@/database/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type NewSyncOperation = InferInsertModel<typeof syncOperations>;

export type SyncOperation = InferSelectModel<typeof syncOperations>;

export type SyncOperationPayload = Pick<
  NewSyncOperation,
  'vaultId' | 'status' | 'error' | 'commitSha'
>;

export type UpdateSyncOperationPayload = Partial<
  SyncOperationPayload & { id: string }
>;
