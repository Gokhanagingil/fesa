import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { ActionCenterService } from './action-center.service';
import { ListActionCenterItemsQueryDto } from './dto/list-action-center-items-query.dto';
import { UpdateActionCenterItemsDto } from './dto/update-action-center-items.dto';

@Controller('action-center')
@UseGuards(TenantGuard)
export class ActionCenterController {
  constructor(private readonly actionCenter: ActionCenterService) {}

  @Get('items')
  list(@Req() req: Request, @Query() query: ListActionCenterItemsQueryDto) {
    return this.actionCenter.listItems(req.tenantId!, query);
  }

  @Patch('items')
  update(@Req() req: Request, @Body() dto: UpdateActionCenterItemsDto) {
    return this.actionCenter.updateItems(req.tenantId!, dto);
  }
}
