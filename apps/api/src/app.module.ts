import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation';
import { configuration } from './config/configuration';
import { domainEntities } from './database/entities';
import { CoreModule } from './modules/core/core.module';
import { HealthModule } from './modules/health/health.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { AthleteModule } from './modules/athlete/athlete.module';
import { GroupModule } from './modules/group/group.module';
import { TeamModule } from './modules/team/team.module';
import { FinanceModule } from './modules/finance/finance.module';
import { ReportingModule } from './modules/reporting/reporting.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: domainEntities,
        synchronize: process.env.NODE_ENV !== 'production',
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    CoreModule,
    HealthModule,
    TenantModule,
    AthleteModule,
    GroupModule,
    TeamModule,
    FinanceModule,
    ReportingModule,
  ],
})
export class AppModule {}
