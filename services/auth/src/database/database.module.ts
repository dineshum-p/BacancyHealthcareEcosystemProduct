import { Global, Module } from '@nestjs/common';
import { Pool } from 'pg';
import { getDatabaseConfig } from '../config/database.config';
import { PG_POOL } from './database.tokens';

/**
 * Provides the single shared `pg` Pool used to read the tenant registry
 * (public schema, read-only -- see `TenantsRepository`) and to hand out
 * per-request clients bound to a tenant's schema for the `users` /
 * `refresh_tokens` tables this service owns. Global so any feature module
 * can inject PG_POOL without having to re-import this module explicitly.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: (): Pool => new Pool(getDatabaseConfig()),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule {}
