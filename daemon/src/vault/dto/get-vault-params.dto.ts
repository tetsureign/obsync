import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const getVaultParamsSchema = z.object({
  id: z.uuid(),
});

export class GetVaultParamsDto extends createZodDto(getVaultParamsSchema) {}
