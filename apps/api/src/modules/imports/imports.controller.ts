import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { ImportsService } from './imports.service';
import { ImportCommitDto, ImportPreviewDto, IMPORT_ENTITY_KEYS } from './dto/import-preview.dto';

@Controller('imports')
@UseGuards(TenantGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Get('definitions')
  definitions() {
    return { items: this.imports.listDefinitions() };
  }

  @Get('template')
  template(@Query('entity') entity: string, @Res() res: Response) {
    if (!entity || !(IMPORT_ENTITY_KEYS as readonly string[]).includes(entity)) {
      throw new BadRequestException(`Unknown import entity "${entity ?? ''}".`);
    }
    const { csv, filename } = this.imports.buildTemplate(entity as ImportPreviewDto['entity']);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Req() req: Request, @Body() dto: ImportPreviewDto) {
    return this.imports.preview(req.tenantId!, dto);
  }

  @Post('commit')
  @HttpCode(200)
  commit(@Req() req: Request, @Body() dto: ImportCommitDto) {
    return this.imports.commit(req.tenantId!, dto);
  }
}
