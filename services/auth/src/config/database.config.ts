export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Reads Postgres connection settings from the environment.
 * Defaults match `docker-compose.test.yml` so `npm run test:e2e` works
 * out of the box against the ephemeral test database.
 *
 * NOTE (schema-per-tenant, shared cluster): in a real deployment this must
 * point at the SAME Postgres cluster/database `services/tenant` uses so this
 * service can read the shared `public.tenants` registry (read-only from
 * auth's perspective -- see `TenantsRepository`) and bind connections to
 * tenant schemas that already exist. The defaults below are only for this
 * service's own isolated local/CI testing (see `docker-compose.test.yml`).
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5545),
    user: process.env.DB_USER ?? 'auth_service',
    password: process.env.DB_PASSWORD ?? 'auth_service',
    database: process.env.DB_NAME ?? 'auth_service',
  };
}
