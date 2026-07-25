import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getVaultParamsSchema = z.object({
  name: z.string().min(1),
});

export class GetVaultParamsDto extends createZodDto(getVaultParamsSchema) {}
