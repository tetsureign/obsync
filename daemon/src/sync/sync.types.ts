import { syncOperations } from '@/database/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import PQueue from 'p-queue';

export type NewSyncOperation = InferInsertModel<typeof syncOperations>;

export type SyncOperation = InferSelectModel<typeof syncOperations>;

export type SyncOperationPayload = Pick<
  NewSyncOperation,
  'vaultId' | 'status' | 'error' | 'commitSha'
>;

export type UpdateSyncOperationPayload = Partial<
  SyncOperationPayload & { id: string }
>;

export type SyncStatus = {
  activeOperation: SyncOperation | undefined;
  recentOperations: SyncOperation[];
  runtime: {
    hasInMemoryWork: boolean;
    queuedCount: number;
    runningCount: number;
    runningTasks: PQueue['runningTasks'];
  };
};
