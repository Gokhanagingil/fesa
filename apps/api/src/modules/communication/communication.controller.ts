import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { CommunicationService } from './communication.service';
import { OutreachService } from './outreach.service';
import { ListCommunicationAudienceQueryDto } from './dto/list-communication-audience-query.dto';
import { ListOutreachQueryDto } from './dto/list-outreach-query.dto';
import { LogOutreachDto } from './dto/log-outreach.dto';
import { COMMUNICATION_CHANNELS, COMMUNICATION_TEMPLATES } from './templates';

@Controller('communications')
@UseGuards(TenantGuard)
export class CommunicationController {
  constructor(
    private readonly communications: CommunicationService,
    private readonly outreach: OutreachService,
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
    };
  }

  @Get('outreach')
  listOutreach(@Req() req: Request, @Query() query: ListOutreachQueryDto) {
    return this.outreach.list(req.tenantId!, query);
  }

  @Post('outreach')
  logOutreach(@Req() req: Request, @Body() body: LogOutreachDto) {
    return this.outreach.log(req.tenantId!, req.staffUserId ?? null, body);
  }
}
