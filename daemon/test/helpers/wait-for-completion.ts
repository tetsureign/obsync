/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { AuthedRequest } from './test-app';

const COMPLETION_TIMEOUT_MS = 15_000;
const POLL_INTERVAL_MS = 100;

export interface RecentOperation {
  id: string;
  status: string;
  step: string;
  error: string | null;
  commitSha: string | null;
}

export async function waitForCompletion(
  authedRequest: AuthedRequest,
  vaultName: string,
  expectedStatus: string,
): Promise<RecentOperation> {
  const deadline = Date.now() + COMPLETION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { body } = await authedRequest().get(`/vaults/${vaultName}/status`);
    // updatedAt has second precision, so desc-ordering can tie between rows
    // that finish in the same second — scan rather than trust [0].
    const recent = (body.recentOperations ?? []) as RecentOperation[];
    const latest = recent.find((op) => op.status === expectedStatus);
    if (latest) return latest;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Sync on '${vaultName}' did not reach status '${expectedStatus}' within ${COMPLETION_TIMEOUT_MS}ms`,
  );
}
