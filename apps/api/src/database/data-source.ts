import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { domainEntities } from './entities';

/**
 * Standalone TypeORM data source for CLI migrations (`npm run migration:*`).
 * Uses the same entities as the Nest app; DATABASE_URL must be set.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: domainEntities,
  migrations: ['dist/database/migrations/*.js'],
});
