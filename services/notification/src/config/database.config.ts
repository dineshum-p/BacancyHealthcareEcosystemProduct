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
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5546),
    user: process.env.DB_USER ?? 'notification_service',
    password: process.env.DB_PASSWORD ?? 'notification_service',
    database: process.env.DB_NAME ?? 'notification_service',
  };
}
