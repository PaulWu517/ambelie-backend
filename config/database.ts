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
          ssl: env.bool('DATABASE_SSL', false) && {
            rejectUnauthorized: env.bool('DATABASE_SSL_SELF', false),
          },
        },
        pool: {
          min: env.int('DATABASE_POOL_MIN', 2),
          max: env.int('DATABASE_POOL_MAX', 5),
        },
        acquireConnectionTimeout: env.int('DATABASE_CONNECTION_TIMEOUT', 30000),
        debug: false,
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
