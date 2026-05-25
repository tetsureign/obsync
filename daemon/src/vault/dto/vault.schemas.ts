import { z } from 'zod';

export const vaultConflictStrategySchema = z.enum([
  'log-and-skip',
  'stash-and-retry',
]);

export const vaultCoreSchema = z.object({
  name: z.string(),
  localPath: z.string(),
  remote: z.string(),
  branch: z.string(),
  autoSync: z.boolean(),
  syncInterval: z.number(),
  conflictStrategy: vaultConflictStrategySchema,
});

export const vaultResponseSchema = vaultCoreSchema.extend({
  id: z.string(),
  isDirty: z.boolean(),
  lastSyncedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export const createVaultCommandSchema = vaultCoreSchema.extend({
  branch: vaultCoreSchema.shape.branch.default('main'),
  autoSync: vaultCoreSchema.shape.autoSync.default(false),
  syncInterval: vaultCoreSchema.shape.syncInterval.default(5 * 60),
  conflictStrategy:
    vaultCoreSchema.shape.conflictStrategy.default('log-and-skip'),
});

export const updateVaultCommandSchema = vaultCoreSchema.partial();
