import { createZodDto } from 'nestjs-zod';
import { createVaultCommandSchema } from './vault.schemas';

export class CreateVaultCommandDto extends createZodDto(
  createVaultCommandSchema,
) {}
