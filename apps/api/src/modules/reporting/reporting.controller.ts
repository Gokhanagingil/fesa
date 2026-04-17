import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { ReportEntityKey, ReportRunRequest } from '@amateur/shared-types';
import { TenantGuard } from '../core/tenant.guard';
import { ReportingService } from './reporting.service';
import { SavedViewsService, SavedViewInput } from './saved-views.service';
import { renderCsv } from './csv.util';
import { REPORT_ENTITY_KEYS } from './catalog';

function assertEntity(entity: string | undefined): asserts entity is ReportEntityKey {
  if (!entity || !REPORT_ENTITY_KEYS.includes(entity as ReportEntityKey)) {
    throw new BadRequestException(`Unknown reporting entity "${entity ?? ''}".`);
  }
}

@Controller('reporting')
@UseGuards(TenantGuard)
export class ReportingController {
  constructor(
    private readonly reporting: ReportingService,
    private readonly savedViews: SavedViewsService,
  ) {}

  @Get('definitions')
  definitions(@Req() req: Request) {
    return this.reporting.definitions(req.tenantId!);
  }

  @Get('command-center')
  commandCenter(@Req() req: Request) {
    return this.reporting.commandCenter(req.tenantId!, req.staffUserId!);
  }

  @Get('catalog')
  catalog() {
    return this.reporting.catalog();
  }

  @Post('run')
  @HttpCode(200)
  run(@Req() req: Request, @Body() body: ReportRunRequest) {
    assertEntity(body?.entity);
    return this.reporting.run(req.tenantId!, body);
  }

  @Post('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@Req() req: Request, @Body() body: ReportRunRequest, @Res() res: Response) {
    assertEntity(body?.entity);
    const limit = Math.min(body.limit ?? 1000, 5000);
    const response = await this.reporting.run(req.tenantId!, { ...body, limit, offset: 0 });
    const labelMap = response.columns.reduce<Record<string, string>>((acc, key) => {
      acc[key] = key;
      return acc;
    }, {});
    const csv = renderCsv(response, labelMap);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="amateur-${response.entity}-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(csv);
  }

  @Get('saved-views')
  listViews(@Req() req: Request, @Query('entity') entity?: string) {
    if (entity) assertEntity(entity);
    return this.savedViews
      .list(req.tenantId!, req.staffUserId!, entity as ReportEntityKey | undefined)
      .then((items) => ({ items }));
  }

  @Post('saved-views')
  createView(@Req() req: Request, @Body() body: SavedViewInput) {
    assertEntity(body?.entity);
    return this.savedViews.create(req.tenantId!, req.staffUserId!, body);
  }

  @Get('saved-views/:id')
  getView(@Req() req: Request, @Param('id') id: string) {
    return this.savedViews.get(req.tenantId!, req.staffUserId!, id);
  }

  @Patch('saved-views/:id')
  updateView(@Req() req: Request, @Param('id') id: string, @Body() body: Partial<SavedViewInput>) {
    return this.savedViews.update(req.tenantId!, req.staffUserId!, id, body);
  }

  @Delete('saved-views/:id')
  deleteView(@Req() req: Request, @Param('id') id: string) {
    return this.savedViews.remove(req.tenantId!, req.staffUserId!, id).then(() => ({ ok: true }));
  }
}
