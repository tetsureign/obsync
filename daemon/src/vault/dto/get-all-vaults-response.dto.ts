import { createZodDto } from 'nestjs-zod';
import { vaultResponseSchema } from './vault.schemas';

const getAllVaultsResponseSchema = vaultResponseSchema.array();

export class GetAllVaultsResponseDto extends createZodDto(
  getAllVaultsResponseSchema,
) {}
