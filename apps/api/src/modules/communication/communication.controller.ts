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
import { ListCommunicationAudienceQueryDto } from './dto/list-communication-audience-query.dto';
import { ListOutreachQueryDto } from './dto/list-outreach-query.dto';
import { LogOutreachDto, OutreachStatus } from './dto/log-outreach.dto';
import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_TEMPLATES,
  COMMUNICATION_TEMPLATE_TOKENS,
} from './templates';

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
      tokens: COMMUNICATION_TEMPLATE_TOKENS,
    };
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
}
