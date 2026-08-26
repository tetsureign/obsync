import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const getGitDiffQueryDto = z.object({
  options: z
    .preprocess((val: [] | string | undefined | null) => {
      if (val === undefined || val === null) return [];
      // If it's already parsed as an array by Express (repeated keys case), keep it
      if (Array.isArray(val)) return val;
      // If it's a single key value, wrap it into an array
      return [String(val)];
    }, z.array(z.string()))
    .optional(), // e.g. ['--cached'] to get staged changes
});

export class GetGitDiffQueryDto extends createZodDto(getGitDiffQueryDto) {}
