import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const API_STARTED_AT = new Date().toISOString();

function resolveDatabaseExpectation(databaseUrl: string | undefined): {
  expectedName: string | null;
  host: string | null;
} {
  if (!databaseUrl) {
    return { expectedName: null, host: null };
  }

  try {
    const parsed = new URL(databaseUrl);
    return {
      expectedName: parsed.pathname.replace(/^\//, '') || null,
      host: parsed.hostname || null,
    };
  } catch {
    return { expectedName: null, host: null };
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => {
        await this.dataSource.query('SELECT 1');
        return { database: { status: 'up' } };
      },
    ]);
  }

  @Get('live')
  live() {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  @Get('version')
  async version() {
    const [row] = await this.dataSource.query('SELECT current_database() AS name');
    const expected = resolveDatabaseExpectation(this.config.get<string>('database.url'));

    return {
      commit: process.env.FESA_GIT_SHA ?? 'unknown',
      builtAt: process.env.FESA_BUILD_TIME_UTC ?? null,
      startedAt: API_STARTED_AT,
      database: {
        currentName: row?.name ?? null,
        expectedName: expected.expectedName,
        host: expected.host,
      },
    };
  }
}
