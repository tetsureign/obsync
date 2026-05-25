import { createZodDto } from 'nestjs-zod';
import { updateVaultCommandSchema } from './vault.schemas';

export class UpdateVaultCommandDto extends createZodDto(
  updateVaultCommandSchema,
) {}
