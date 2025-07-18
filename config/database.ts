import path from 'path';

export default ({ env }) => {
  if (env('NODE_ENV') === 'production') {
    if (!env('DATABASE_URL')) {
      throw new Error('DATABASE_URL environment variable is required in production');
    }

    return {
      connection: {
        client: 'postgres',
        connection: {
          connectionString: env('DATABASE_URL'),
          ssl: {
            rejectUnauthorized: env.bool('DATABASE_SSL_REJECT_UNAUTHORIZED', false),
          },
        },
        pool: {
          min: env.int('DATABASE_POOL_MIN', 2),
          max: env.int('DATABASE_POOL_MAX', 10),
          acquireTimeoutMillis: env.int('DATABASE_ACQUIRE_TIMEOUT', 60000),
          createTimeoutMillis: env.int('DATABASE_CREATE_TIMEOUT', 30000),
          destroyTimeoutMillis: env.int('DATABASE_DESTROY_TIMEOUT', 5000),
          idleTimeoutMillis: env.int('DATABASE_IDLE_TIMEOUT', 30000),
          reapIntervalMillis: env.int('DATABASE_REAP_INTERVAL', 1000),
          createRetryIntervalMillis: env.int('DATABASE_CREATE_RETRY_INTERVAL', 200),
        },
        acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 60000),
        debug: env.bool('DATABASE_DEBUG', false),
      },
    };
  }

  return {
    connection: {
      client: 'sqlite',
      connection: {
        filename: env('DATABASE_FILENAME', '.tmp/data.db'),
      },
      useNullAsDefault: true,
    },
  };
};
