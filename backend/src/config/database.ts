import knex, { Knex } from 'knex';
import { config } from './env';

function createKnexConfig(): Knex.Config {
  if (config.DB_CLIENT === 'pg') {
    return {
      client: 'pg',
      connection: config.DATABASE_URL,
      pool: { min: 2, max: 10 },
      migrations: {
        tableName: 'knex_migrations',
        directory: './src/db/migrations',
      },
    };
  }

  return {
    client: 'better-sqlite3',
    connection: {
      filename: config.DB_FILENAME ?? './centurion.db',
    },
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
    migrations: {
      tableName: 'knex_migrations',
      directory: './src/db/migrations',
    },
  };
}

const db = knex(createKnexConfig());

export default db;
