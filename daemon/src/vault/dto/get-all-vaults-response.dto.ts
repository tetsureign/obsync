import { createZodDto } from 'nestjs-zod';
import { vaultResponseSchema } from './vault.schemas';

const GetAllVaultsResponseSchema = vaultResponseSchema.array();

export class GetAllVaultsResponseDto extends createZodDto(
  GetAllVaultsResponseSchema,
) {}
