import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getSyncStatusQuerySchema = z.object({
  lastNCompletedSync: z.coerce.number().optional().default(5),
});

export class GetSyncStatusQueryDto extends createZodDto(
  getSyncStatusQuerySchema,
) {}
