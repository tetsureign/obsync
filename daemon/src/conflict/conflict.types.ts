import { conflictRecords } from '@/database/schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

export type PartialConflictRecord = InferInsertModel<typeof conflictRecords>;
export type ConflictRecord = InferSelectModel<typeof conflictRecords>;
