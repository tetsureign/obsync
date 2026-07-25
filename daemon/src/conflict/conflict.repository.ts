import { Database } from '@/database/database';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { conflictRecords } from '@/database/schema';
import { PartialConflictRecord } from './conflict.types';

@Injectable()
export class ConflictRepository {
  constructor(private readonly database: Database) {}

  async findAll() {
    return await this.database.db.select().from(conflictRecords);
  }

  findById(id: string) {
    return this.database.db
      .select()
      .from(conflictRecords)
      .where(eq(conflictRecords.id, id))
      .limit(1)
      .get();
  }

  async create(data: PartialConflictRecord) {
    return await this.database.db
      .insert(conflictRecords)
      .values(data)
      .returning();
  }
}
