import { Module } from '@nestjs/common';
import { ConflictRepository } from './conflict.repository';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ConflictRepository],
  exports: [ConflictRepository],
})
export class ConflictModule {}
