import { AppError } from '@/common/errors/app.error';

export class SyncStepTransitionError extends AppError {
  constructor(
    vaultId: string,
    syncOperationId: string,
    syncStep: string,
    cause?: unknown,
  ) {
    super(
      `Sync operation ${syncOperationId} for vault ${vaultId} could not transition to ${syncStep}`,
      'SYNC_STEP_TRANSITION_ERROR',
      500,
      {
        vaultId,
        syncOperationId,
        syncStep,
        cause,
      },
    );
  }
}
