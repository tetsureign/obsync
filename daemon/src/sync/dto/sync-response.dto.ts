import { syncCoreSchema } from './sync.schemas';
import { createZodDto } from 'nestjs-zod';

export class SyncResponseDto extends createZodDto(syncCoreSchema) {}
