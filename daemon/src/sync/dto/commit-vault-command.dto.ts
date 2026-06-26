import { commitVaultCommandSchema } from './sync.schemas';
import { createZodDto } from 'nestjs-zod';

export class CommitVaultCommandDto extends createZodDto(
  commitVaultCommandSchema,
) {}
