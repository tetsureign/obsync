import { syncResponseSchema } from './sync.schemas';
import { createZodDto } from 'nestjs-zod';

const getHistoryQueryResponseSchema = syncResponseSchema.array();

export class GetHistoryQueryResponseDto extends createZodDto(
  getHistoryQueryResponseSchema,
) {}
