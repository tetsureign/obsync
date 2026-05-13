import { Module } from '@nestjs/common';
import { SyncQueue } from './sync-queue';

@Module({
  providers: [SyncQueue],
  exports: [SyncQueue],
})
export class SyncQueueModule {}
