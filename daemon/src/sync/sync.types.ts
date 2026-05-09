import { syncOperations } from '@/database/schema';
import type { InferInsertModel } from 'drizzle-orm';

export type NewSyncRecord = InferInsertModel<typeof syncOperations>;

export type SyncRecordPayload = Pick<
  NewSyncRecord,
  'vaultId' | 'status' | 'error' | 'commitSha'
>;

export type UpdateSyncRecordPayload = Partial<
  SyncRecordPayload & { id: string }
>;
