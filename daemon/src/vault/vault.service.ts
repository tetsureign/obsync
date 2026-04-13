import { Database } from '@/database/database';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VaultService {
  constructor(private readonly database: Database) {}
}
