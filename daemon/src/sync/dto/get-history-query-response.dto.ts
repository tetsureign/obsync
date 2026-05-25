import { syncCoreSchema } from './sync.schemas';
import { createZodDto } from 'nestjs-zod';

const getHistoryQueryResponseSchema = syncCoreSchema.array();

export class GetHistoryQueryResponseDto extends createZodDto(
  getHistoryQueryResponseSchema,
) {}
