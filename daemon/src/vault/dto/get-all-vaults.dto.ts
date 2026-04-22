import { createZodDto } from 'nestjs-zod';
import { vaultResponseSchema } from './vault.schemas';

const GetAllVaultsSchema = vaultResponseSchema.array();

export class GetAllVaultsDto extends createZodDto(GetAllVaultsSchema) {}
