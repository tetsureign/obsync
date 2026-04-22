import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const GetVaultParamsSchema = z.object({
  id: z.string(),
});

export class GetVaultParamsDto extends createZodDto(GetVaultParamsSchema) {}
