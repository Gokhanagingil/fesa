import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { CommunicationService } from './communication.service';
import { ListCommunicationAudienceQueryDto } from './dto/list-communication-audience-query.dto';

@Controller('communications')
@UseGuards(TenantGuard)
export class CommunicationController {
  constructor(private readonly communications: CommunicationService) {}

  @Get('audiences')
  listAudience(@Req() req: Request, @Query() query: ListCommunicationAudienceQueryDto) {
    return this.communications.listAudience(req.tenantId!, query);
  }
}
