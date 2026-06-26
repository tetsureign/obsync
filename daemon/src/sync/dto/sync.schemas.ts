import { currentInstantIso } from '@/common/utils/temporal';
import { z } from 'zod';

export const syncCoreSchema = z.object({
  id: z.string(),
  vaultId: z.string(),
  status: z.enum(['queued', 'running', 'success', 'failed', 'aborted']),
  step: z.enum(['pull', 'stage', 'commit', 'push', 'done']),
  error: z.string().nullable(),
  commitSha: z.string().nullable(),
  startedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export const syncVaultCommandSchema = z.object({
  filePaths: z.array(z.string()).default(['.']),
  commitMessage: z
    .string()
    .default(() => `auto commit at ${currentInstantIso()}`),
});

export const stageVaultCommandSchema = syncVaultCommandSchema.pick({
  filePaths: true,
});

export const commitVaultCommandSchema = syncVaultCommandSchema.pick({
  commitMessage: true,
});
