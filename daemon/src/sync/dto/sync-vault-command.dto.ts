import { createZodDto } from 'nestjs-zod';
import { syncVaultCommandSchema } from './sync.schemas';

export class SyncVaultCommandDto extends createZodDto(syncVaultCommandSchema) {}
