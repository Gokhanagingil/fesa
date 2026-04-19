import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { CommunicationService } from './communication.service';
import { OutreachService } from './outreach.service';
import { CommunicationDeliveryService } from './delivery/communication-delivery.service';
import { WhatsAppReadinessService } from './delivery/whatsapp-readiness.service';
import { DeliveryChannel } from './delivery/types';
import { ListCommunicationAudienceQueryDto } from './dto/list-communication-audience-query.dto';
import { ListOutreachQueryDto } from './dto/list-outreach-query.dto';
import { LogOutreachDto, OutreachStatus } from './dto/log-outreach.dto';
import { DeliverOutreachDto } from './dto/deliver-outreach.dto';
import { SaveWhatsAppReadinessDto } from './dto/save-readiness.dto';
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_DRAFT_STALE_AFTER_DAYS,
  COMMUNICATION_TEMPLATES,
  COMMUNICATION_TEMPLATE_TOKENS,
} from './templates';

const ALLOWED_DELIVERY_CHANNELS: DeliveryChannel[] = ['whatsapp', 'phone', 'email', 'manual'];

@Controller('communications')
@UseGuards(TenantGuard)
export class CommunicationController {
  constructor(
    private readonly communications: CommunicationService,
    private readonly outreach: OutreachService,
    private readonly delivery: CommunicationDeliveryService,
    private readonly readiness: WhatsAppReadinessService,
  ) {}

  @Get('audiences')
  listAudience(@Req() req: Request, @Query() query: ListCommunicationAudienceQueryDto) {
    return this.communications.listAudience(req.tenantId!, query);
  }

  @Get('templates')
  listTemplates() {
    return {
      channels: COMMUNICATION_CHANNELS,
      items: COMMUNICATION_TEMPLATES,
      tokens: COMMUNICATION_TEMPLATE_TOKENS,
      lifecycle: {
        staleAfterDays: COMMUNICATION_DRAFT_STALE_AFTER_DAYS,
      },
    };
  }

  @Get('readiness')
  async getReadiness(@Req() req: Request, @Query('channel') channel?: string) {
    const tenantId = req.tenantId!;
    const requestedChannel: DeliveryChannel =
      channel && (ALLOWED_DELIVERY_CHANNELS as string[]).includes(channel)
        ? (channel as DeliveryChannel)
        : 'whatsapp';
    const [whatsapp, plan] = await Promise.all([
      this.readiness.getSummary(tenantId),
      this.delivery.planFor(tenantId, requestedChannel),
    ]);
    return {
      channel: requestedChannel,
      whatsapp,
      plan,
    };
  }

  @Put('readiness/whatsapp')
  saveWhatsAppReadiness(@Req() req: Request, @Body() body: SaveWhatsAppReadinessDto) {
    return this.readiness.saveSummary(req.tenantId!, body);
  }

  @Post('readiness/whatsapp/validate')
  validateWhatsAppReadiness(
    @Req() req: Request,
    @Body() body?: { mode?: 'local' | 'live' },
  ) {
    if (body?.mode === 'live') {
      return this.readiness.runLiveValidation(req.tenantId!);
    }
    return this.readiness.runValidation(req.tenantId!);
  }

  @Get('outreach')
  listOutreach(@Req() req: Request, @Query() query: ListOutreachQueryDto) {
    return this.outreach.list(req.tenantId!, query);
  }

  @Get('outreach/:id')
  getOutreach(@Req() req: Request, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.outreach.findOne(req.tenantId!, id);
  }

  @Post('outreach')
  logOutreach(@Req() req: Request, @Body() body: LogOutreachDto) {
    return this.outreach.log(req.tenantId!, req.staffUserId ?? null, body);
  }

  @Put('outreach/:id')
  updateOutreach(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: LogOutreachDto,
  ) {
    return this.outreach.update(req.tenantId!, id, body);
  }

  @Patch('outreach/:id/status')
  setOutreachStatus(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { status?: OutreachStatus },
  ) {
    if (!body?.status || !['draft', 'logged', 'archived'].includes(body.status)) {
      throw new BadRequestException('status must be one of: draft, logged, archived');
    }
    return this.outreach.setStatus(req.tenantId!, id, body.status);
  }

  @Post('outreach/:id/deliver')
  attemptDelivery(
    @Req() req: Request,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: DeliverOutreachDto,
  ) {
    return this.outreach.attemptDelivery(req.tenantId!, id, body);
  }
}
