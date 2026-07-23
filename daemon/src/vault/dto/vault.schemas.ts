import { z } from 'zod';
import path from 'path';

export const vaultConflictStrategySchema = z.enum([
  'log-and-skip',
  'stash-and-retry',
]);

// Regex matches standard Unix absolute paths or Windows drive letter paths
const absolutePathRegex = /^([a-zA-Z]:\\|\/)[^<>:"|?*]*$/;

export const vaultCoreSchema = z.object({
  name: z.string(),
  localPath: z
    .string()
    .regex(absolutePathRegex)
    // Prevent path traversal by disallowing segments like '..' or '.'
    .refine(
      (val) => {
        const segments = val.split(/[/\\]/);
        return !segments.includes('..') && !segments.includes('.');
      },
      {
        message: 'Path traversal (.. or .) is not allowed',
      },
    )
    .transform((val) => path.normalize(val)),
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
  name: vaultCoreSchema.shape.name.default(''),
  autoSync: vaultCoreSchema.shape.autoSync.default(false),
  syncInterval: vaultCoreSchema.shape.syncInterval.default(5 * 60),
  conflictStrategy:
    vaultCoreSchema.shape.conflictStrategy.default('log-and-skip'),
});

export const updateVaultCommandSchema = vaultCoreSchema.partial();
