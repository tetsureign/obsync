import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';
import pRetry from 'p-retry';

@Injectable()
export class SyncQueue {
  private queues = new Map<string, PQueue>();

  getQueue(vaultId: string) {
    if (!this.queues.has(vaultId)) {
      this.queues.set(vaultId, new PQueue({ concurrency: 1 }));
    }
    return this.queues.get(vaultId)!;
  }

  async addToVaultQueue(
    vaultId: string,
    fn: () => Promise<void>,
    priority = 0,
  ) {
    const queue = this.getQueue(vaultId);
    return queue.add(
      async () => {
        await pRetry(fn, {
          retries: 3,
          minTimeout: 1000,
          factor: 5,
        });
      },
      { priority },
    );
  }
}
