import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import pRetry from 'p-retry';

@Injectable()
export class SyncQueue {
  private queue = new PQueue({ concurrency: 1 });

  add(fn: () => Promise<void>) {
    return this.queue.add(async () => {
      await pRetry(fn, {
        retries: 3,
        minTimeout: 1000,
        factor: 5,
      });
    });
  }
}
