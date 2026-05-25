import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const getGitDiffQueryDto = z.object({
  options: z.array(z.string()).optional(), // e.g. ['--cached'] to get staged changes
});

export class GetGitDiffQueryDto extends createZodDto(getGitDiffQueryDto) {}
