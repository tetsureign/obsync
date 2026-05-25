import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getVaultByPathQuerySchema = z.object({
  localPath: z.string(),
});

export class GetVaultByPathQueryDto extends createZodDto(
  getVaultByPathQuerySchema,
) {}
