import { vaults } from '@/database/schema';
import type { InferInsertModel } from 'drizzle-orm';

export type NewVault = InferInsertModel<typeof vaults>;
