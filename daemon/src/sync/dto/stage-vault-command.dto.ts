import { stageVaultCommandSchema } from './sync.schemas';
import { createZodDto } from 'nestjs-zod';

export class StageVaultCommandDto extends createZodDto(
  stageVaultCommandSchema,
) {}
