import { Injectable } from '@nestjs/common';
import PQueue from 'p-queue';

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
    return queue.add(fn, { priority });
  }

  hasVaultWorks(vaultId: string) {
    const queue = this.getQueue(vaultId);

    if (!queue) {
      return false;
    }

    return queue.size > 0 || queue.pending > 0;
  }

  getVaultQueueStatus(vaultId: string) {
    const queue = this.getQueue(vaultId);

    if (!queue) {
      return {
        hasInMemoryWork: false,
        queuedCount: 0,
        runningCount: 0,
        runningTasks: [],
      };
    }

    return {
      hasInMemoryWork: queue.size > 0 || queue.pending > 0,
      queuedCount: queue.size,
      runningCount: queue.pending,
      runningTasks: queue.runningTasks,
    };
  }
}
