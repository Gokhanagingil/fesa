import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../core/tenant.guard';
import { OnboardingService } from './onboarding.service';

/**
 * Read-only state endpoint behind the Club Onboarding Wizard. Returns a
 * calm, deduplicated view of "what's filled in" for the current club so the
 * wizard can render its step rail and route the user to the next sensible
 * action without ever leaking another tenant's data.
 */
@Controller('onboarding')
@UseGuards(TenantGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('state')
  state(@Req() req: Request) {
    return this.onboarding.getState(req.tenantId!);
  }
}
