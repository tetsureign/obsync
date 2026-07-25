import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';

@Injectable()
export class SyncQueue {
  // Keyed by vault name — the stable, unique, CLI-facing identifier.
  // No id lookup needed before interacting with the queue.
  private queues = new Map<string, PQueue>();

  getQueue(vaultName: string) {
    if (!this.queues.has(vaultName)) {
      this.queues.set(vaultName, new PQueue({ concurrency: 1 }));
    }
    return this.queues.get(vaultName)!;
  }

  async addToVaultQueue(
    vaultName: string,
    fn: () => Promise<void>,
    priority = 0,
  ) {
    const queue = this.getQueue(vaultName);
    return queue.add(fn, { priority });
  }

  hasVaultWorks(vaultName: string) {
    const queue = this.getQueue(vaultName);

    return queue.size > 0 || queue.pending > 0;
  }

  getVaultQueueStatus(vaultName: string) {
    const queue = this.getQueue(vaultName);

    return {
      hasInMemoryWork: queue.size > 0 || queue.pending > 0,
      queuedCount: queue.size,
      runningCount: queue.pending,
      runningTasks: queue.runningTasks,
    };
  }

  abortVaultQueue(vaultName: string) {
    const queue = this.getQueue(vaultName);

    if (queue) {
      queue.clear();
      return true;
    }

    return false;
  }
}
