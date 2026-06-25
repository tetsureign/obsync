import { syncOperations } from '@/database/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import PQueue from 'p-queue';

export type PartialSyncOperation = InferInsertModel<typeof syncOperations>;
export type SyncOperation = InferSelectModel<typeof syncOperations>;

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
