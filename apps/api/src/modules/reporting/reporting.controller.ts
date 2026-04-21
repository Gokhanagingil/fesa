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
import { LICENSE_FEATURE_KEYS } from '../licensing/license.constants';
import { FeatureGateGuard, RequireFeature } from '../licensing/feature-gate.guard';
import { ReportingService } from './reporting.service';
import { SavedViewsService, SavedViewInput } from './saved-views.service';
import { renderCsv } from './csv.util';
import { getCatalogEntity, REPORT_ENTITY_KEYS } from './catalog';

function assertEntity(entity: string | undefined): asserts entity is ReportEntityKey {
  if (!entity || !REPORT_ENTITY_KEYS.includes(entity as ReportEntityKey)) {
    throw new BadRequestException(`Unknown reporting entity "${entity ?? ''}".`);
  }
}

/**
 * Best-effort label cleanup for CSV headers when the API has no i18n.
 * Pulls the trailing dotted segment of an i18n key and prettifies it
 * (e.g. "pages.reports.fields.charge.dueDate" -> "Due date").
 */
function humanLabel(input: string): string {
  if (!input) return input;
  if (!input.includes('.') && !/[A-Z]/.test(input)) {
    return input;
  }
  const tail = input.includes('.') ? input.split('.').pop()! : input;
  const spaced = tail
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function slugify(input: string): string {
  return input.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);
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

  @Get('starter-views')
  starterViews(@Query('entity') entity?: string) {
    if (entity) assertEntity(entity);
    return this.reporting.starterViews(entity as ReportEntityKey | undefined);
  }

  @Get('starter-views/:id')
  starterView(@Param('id') id: string) {
    const view = this.reporting.starterView(id);
    if (!view) {
      throw new BadRequestException(`Unknown starter view "${id}".`);
    }
    return view;
  }

  @Post('run')
  @HttpCode(200)
  run(@Req() req: Request, @Body() body: ReportRunRequest) {
    assertEntity(body?.entity);
    return this.reporting.run(req.tenantId!, body);
  }

  @Post('export')
  @UseGuards(FeatureGateGuard)
  @RequireFeature(LICENSE_FEATURE_KEYS.REPORTING_ADVANCED_BUILDER)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@Req() req: Request, @Body() body: ReportRunRequest, @Res() res: Response) {
    assertEntity(body?.entity);
    const limit = Math.min(body.limit ?? 1000, 5000);
    const response = await this.reporting.run(req.tenantId!, { ...body, limit, offset: 0 });
    const entity = getCatalogEntity(response.entity);
    const labelMap = response.columns.reduce<Record<string, string>>((acc, key) => {
      const fromColumnLabels = response.columnLabels?.find((entry) => entry.key === key);
      if (fromColumnLabels) {
        acc[key] = humanLabel(fromColumnLabels.label ?? fromColumnLabels.labelKey ?? key);
      } else {
        const field = entity?.fields.find((definition) => definition.key === key);
        acc[key] = humanLabel(field?.label ?? field?.labelKey ?? key);
      }
      return acc;
    }, {});
    const csv = renderCsv(response, labelMap);
    const filenameSuffix = body.groupBy ? `-grouped-by-${slugify(body.groupBy.field)}` : '';
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="amateur-${response.entity}${filenameSuffix}-${new Date().toISOString().slice(0, 10)}.csv"`,
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
  @UseGuards(FeatureGateGuard)
  @RequireFeature(LICENSE_FEATURE_KEYS.REPORTING_ADVANCED_BUILDER)
  createView(@Req() req: Request, @Body() body: SavedViewInput) {
    assertEntity(body?.entity);
    return this.savedViews.create(req.tenantId!, req.staffUserId!, body);
  }

  @Get('saved-views/:id')
  getView(@Req() req: Request, @Param('id') id: string) {
    return this.savedViews.get(req.tenantId!, req.staffUserId!, id);
  }

  @Patch('saved-views/:id')
  @UseGuards(FeatureGateGuard)
  @RequireFeature(LICENSE_FEATURE_KEYS.REPORTING_ADVANCED_BUILDER)
  updateView(@Req() req: Request, @Param('id') id: string, @Body() body: Partial<SavedViewInput>) {
    return this.savedViews.update(req.tenantId!, req.staffUserId!, id, body);
  }

  @Delete('saved-views/:id')
  @UseGuards(FeatureGateGuard)
  @RequireFeature(LICENSE_FEATURE_KEYS.REPORTING_ADVANCED_BUILDER)
  deleteView(@Req() req: Request, @Param('id') id: string) {
    return this.savedViews.remove(req.tenantId!, req.staffUserId!, id).then(() => ({ ok: true }));
  }
}
