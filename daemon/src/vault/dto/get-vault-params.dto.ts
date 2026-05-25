import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const GetVaultParamsSchema = z.object({
  id: z.uuid(),
});

export class GetVaultParamsDto extends createZodDto(GetVaultParamsSchema) {}
