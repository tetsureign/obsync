import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { join } from 'path';
import { appDataDir } from './src/common/utils/app-paths';

export default defineConfig({
  out: './drizzle',
  schema: './src/database/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_FILE_NAME ?? join(appDataDir, 'obsync.db'),
  },
});
