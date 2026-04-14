import 'reflect-metadata';
import { resolve } from 'path';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { domainEntities } from './entities';

// TypeORM CLI does not load Nest/ConfigModule; resolve apps/api/.env from compiled output (dist/database/ → ../..).
config({ path: resolve(__dirname, '../../.env') });

/**
 * Standalone TypeORM data source for CLI migrations (`npm run migration:*`).
 * Uses the same entities as the Nest app; DATABASE_URL must be set (e.g. in apps/api/.env).
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: domainEntities,
  migrations: ['dist/database/migrations/*.js'],
});
