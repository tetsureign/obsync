import { Module } from '@nestjs/common';
import { GitAdapter } from './git.adapter';

@Module({
  providers: [GitAdapter],
  exports: [GitAdapter],
})
export class GitModule {}
