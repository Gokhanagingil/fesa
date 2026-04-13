import { Controller, Get } from '@nestjs/common';

/**
 * Placeholder for report registry and saved filters API.
 * Full engine, exports, and RBAC come in later waves.
 */
@Controller('reporting')
export class ReportingController {
  @Get('definitions')
  definitions() {
    return {
      items: [],
      message: 'Report definitions will be registered here; see docs/reporting.md',
    };
  }
}
