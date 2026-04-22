import { createZodDto } from 'nestjs-zod';
import { vaultResponseSchema } from './vault.schemas';

export class VaultResponseDto extends createZodDto(vaultResponseSchema) {}
