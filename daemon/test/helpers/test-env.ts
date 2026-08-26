import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

export const testDataDir = join(tmpdir(), `obsync-e2e-data-${randomUUID()}`);

process.env.OBSYNC_APP_DATA_DIR = testDataDir;
