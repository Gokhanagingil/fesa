import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
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
import { GuardianModule } from './modules/guardian/guardian.module';
import { TrainingModule } from './modules/training/training.module';
import { SportBranchModule } from './modules/sport-branch/sport-branch.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('database.url'),
        entities: domainEntities,
        synchronize: config.get<boolean>('database.synchronize', false),
        migrations: [join(__dirname, 'database', 'migrations', '*.js')],
        migrationsRun: false,
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
    GuardianModule,
    TrainingModule,
    SportBranchModule,
  ],
})
export class AppModule {}
