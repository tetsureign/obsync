import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const GetVaultByPathQuerySchema = z.object({
  localPath: z.string(),
});

export class GetVaultByPathQueryDto extends createZodDto(
  GetVaultByPathQuerySchema,
) {}
