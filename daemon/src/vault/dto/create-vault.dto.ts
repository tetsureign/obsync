import { createZodDto } from 'nestjs-zod';
import { createVaultSchema } from './vault.schemas';

export class CreateVaultDto extends createZodDto(createVaultSchema) {}
