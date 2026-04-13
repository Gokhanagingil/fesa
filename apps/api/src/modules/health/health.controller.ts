import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    @InjectDataSource() private readonly dataSource: DataSource,
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
}
