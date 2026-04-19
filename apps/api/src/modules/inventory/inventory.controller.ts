import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { ListInventoryItemsQueryDto } from './dto/list-inventory-items-query.dto';
import { CreateInventoryVariantDto } from './dto/create-inventory-variant.dto';
import { UpdateInventoryVariantDto } from './dto/update-inventory-variant.dto';
import { AdjustInventoryStockDto } from './dto/adjust-inventory-stock.dto';
import {
  AssignInventoryDto,
  ReturnInventoryAssignmentDto,
} from './dto/assign-inventory.dto';
import { BulkReturnInventoryDto } from './dto/bulk-return-inventory.dto';

@Controller('inventory')
@UseGuards(TenantGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('items')
  list(@Req() req: Request, @Query() query: ListInventoryItemsQueryDto) {
    return this.inventory.listItems(req.tenantId!, query);
  }

  @Post('items')
  create(@Req() req: Request, @Body() dto: CreateInventoryItemDto) {
    return this.inventory.createItem(req.tenantId!, dto);
  }

  @Get('items/:id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.inventory.getItemDetail(req.tenantId!, id);
  }

  @Patch('items/:id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventory.updateItem(req.tenantId!, id, dto);
  }

  @Delete('items/:id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.inventory.removeItem(req.tenantId!, id);
  }

  @Get('items/:id/movements')
  movements(@Req() req: Request, @Param('id') id: string) {
    return this.inventory.listMovementsForItem(req.tenantId!, id);
  }

  @Get('items/:id/assignments')
  itemAssignments(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('includeReturned') includeReturned?: string,
  ) {
    return this.inventory.listAssignmentsForItem(req.tenantId!, id, {
      includeReturned: includeReturned === 'true',
    });
  }

  @Post('items/:id/variants')
  createVariant(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateInventoryVariantDto,
  ) {
    return this.inventory.createVariant(req.tenantId!, id, dto);
  }

  @Patch('variants/:variantId')
  updateVariant(
    @Req() req: Request,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateInventoryVariantDto,
  ) {
    return this.inventory.updateVariant(req.tenantId!, variantId, dto);
  }

  @Delete('variants/:variantId')
  removeVariant(@Req() req: Request, @Param('variantId') variantId: string) {
    return this.inventory.removeVariant(req.tenantId!, variantId);
  }

  @Post('variants/:variantId/stock-adjustments')
  adjustStock(
    @Req() req: Request,
    @Param('variantId') variantId: string,
    @Body() dto: AdjustInventoryStockDto,
  ) {
    return this.inventory.adjustStock(req.tenantId!, variantId, dto);
  }

  @Post('assignments')
  assign(@Req() req: Request, @Body() dto: AssignInventoryDto) {
    return this.inventory.assignToAthlete(req.tenantId!, dto, req.staffUserId ?? null);
  }

  @Post('assignments/bulk-return')
  bulkReturn(@Req() req: Request, @Body() dto: BulkReturnInventoryDto) {
    return this.inventory.bulkReturn(req.tenantId!, dto, req.staffUserId ?? null);
  }

  @Post('assignments/:assignmentId/return')
  returnAssignment(
    @Req() req: Request,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: ReturnInventoryAssignmentDto,
  ) {
    return this.inventory.returnAssignment(
      req.tenantId!,
      assignmentId,
      dto,
      req.staffUserId ?? null,
    );
  }

  @Get('athletes/:athleteId/assignments')
  athleteAssignments(
    @Req() req: Request,
    @Param('athleteId') athleteId: string,
    @Query('includeReturned') includeReturned?: string,
  ) {
    return this.inventory.listAssignmentsForAthlete(req.tenantId!, athleteId, {
      includeReturned: includeReturned === 'true',
    });
  }
}
