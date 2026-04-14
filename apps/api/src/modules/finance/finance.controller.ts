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
import { FinanceService } from './finance.service';
import { CreateChargeItemDto } from './dto/create-charge-item.dto';
import { UpdateChargeItemDto } from './dto/update-charge-item.dto';
import { ListChargeItemsQueryDto } from './dto/list-charge-items-query.dto';
import { CreateAthleteChargeDto } from './dto/create-athlete-charge.dto';
import { UpdateAthleteChargeDto } from './dto/update-athlete-charge.dto';
import { ListAthleteChargesQueryDto } from './dto/list-athlete-charges-query.dto';
import { CreateBulkAthleteChargesDto } from './dto/create-bulk-athlete-charges.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { ListAthleteFinanceSummaryQueryDto } from './dto/list-athlete-finance-summary-query.dto';

@Controller('charge-items')
@UseGuards(TenantGuard)
export class ChargeItemController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListChargeItemsQueryDto) {
    return this.finance.listChargeItems(req.tenantId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateChargeItemDto) {
    return this.finance.createChargeItem(req.tenantId!, dto);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.finance.getChargeItem(req.tenantId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateChargeItemDto) {
    return this.finance.updateChargeItem(req.tenantId!, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.finance.removeChargeItem(req.tenantId!, id);
  }
}

@Controller('athlete-charges')
@UseGuards(TenantGuard)
export class AthleteChargeController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListAthleteChargesQueryDto) {
    return this.finance.listAthleteCharges(req.tenantId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreateAthleteChargeDto) {
    return this.finance.createAthleteCharge(req.tenantId!, dto);
  }

  @Post('bulk')
  createBulk(@Req() req: Request, @Body() dto: CreateBulkAthleteChargesDto) {
    return this.finance.createBulkAthleteCharges(req.tenantId!, dto);
  }

  @Get(':id')
  get(@Req() req: Request, @Param('id') id: string) {
    return this.finance.getAthleteCharge(req.tenantId!, id);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAthleteChargeDto) {
    return this.finance.updateAthleteCharge(req.tenantId!, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.finance.removeAthleteCharge(req.tenantId!, id);
  }
}

@Controller('payments')
@UseGuards(TenantGuard)
export class PaymentController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  list(@Req() req: Request, @Query() query: ListPaymentsQueryDto) {
    return this.finance.listPayments(req.tenantId!, query);
  }

  @Post()
  create(@Req() req: Request, @Body() dto: CreatePaymentDto) {
    return this.finance.createPayment(req.tenantId!, dto);
  }
}

@Controller('finance')
@UseGuards(TenantGuard)
export class FinanceSummaryController {
  constructor(private readonly finance: FinanceService) {}

  @Get('athlete-summaries')
  listAthleteSummaries(@Req() req: Request, @Query() query: ListAthleteFinanceSummaryQueryDto) {
    return this.finance.listAthleteFinanceSummaries(req.tenantId!, query);
  }

  @Get('dashboard-summary')
  getDashboardSummary(@Req() req: Request) {
    return this.finance.getDashboardSummary(req.tenantId!);
  }
}
