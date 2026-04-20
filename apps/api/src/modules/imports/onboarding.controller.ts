import {
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { OnboardingService } from './onboarding.service';

/**
 * Read-only state endpoint behind the Club Onboarding Wizard. Returns a
 * calm, deduplicated view of "what's filled in" for the current club so the
 * wizard can render its step rail and route the user to the next sensible
 * action without ever leaking another tenant's data.
 *
 * v1.1 (Go-Live Confidence Pack) added a sibling history endpoint for the
 * onboarding-aligned import batches recorded server-side on commit.
 *
 * v1.2 (Onboarding Completion Pack) extends history with a per-step filter,
 * a batch detail endpoint for calm result recall, and the recommended-actions
 * + first-30-days companion fields surfaced inline on `state`.
 */
@Controller('onboarding')
@UseGuards(TenantGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('state')
  state(@Req() req: Request) {
    return this.onboarding.getState(req.tenantId!);
  }

  @Get('history')
  async history(
    @Req() req: Request,
    @Query('limit', new DefaultValuePipe(25), ParseIntPipe) limit: number,
    @Query('step') step?: string,
  ) {
    const items = await this.onboarding.getHistory(req.tenantId!, {
      limit,
      step: step?.trim() || undefined,
    });
    return { items };
  }

  @Get('batches/:id')
  async batch(@Req() req: Request, @Param('id') id: string) {
    const detail = await this.onboarding.getBatch(req.tenantId!, id);
    if (!detail) {
      throw new NotFoundException('Import batch not found');
    }
    return detail;
  }
}
