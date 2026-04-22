import { createZodDto } from 'nestjs-zod';
import { updateVaultSchema } from './vault.schemas';

export class UpdateVaultDto extends createZodDto(updateVaultSchema) {}
