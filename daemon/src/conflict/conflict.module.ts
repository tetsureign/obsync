import { Module } from '@nestjs/common';
import { ConflictRepository } from './conflict.repository';

@Module({
  providers: [ConflictRepository],
  exports: [ConflictRepository],
})
export class ConflictModule {}
