import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { GuardianPortalAccess } from '../../database/entities/guardian-portal-access.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { OutreachActivity } from '../../database/entities/outreach-activity.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Team } from '../../database/entities/team.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { TenantCommunicationConfig } from '../../database/entities/tenant-communication-config.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { FinanceModule } from '../finance/finance.module';
import { FamilyActionModule } from '../family-action/family-action.module';
import { LicensingModule } from '../licensing/licensing.module';
import { CommunicationController } from './communication.controller';
import { CommunicationService } from './communication.service';
import { OutreachService } from './outreach.service';
import { AssistedDeliveryProvider } from './delivery/assisted-provider';
import { CommunicationDeliveryService } from './delivery/communication-delivery.service';
import { WhatsAppCloudApiProvider } from './delivery/whatsapp-cloud-api-provider';
import {
  WHATSAPP_CLOUD_API_FETCHER,
  WhatsAppCloudApiClient,
  defaultWhatsAppFetcher,
} from './delivery/whatsapp-cloud-api.client';
import { WhatsAppReadinessService } from './delivery/whatsapp-readiness.service';

@Module({
  imports: [
    FinanceModule,
    FamilyActionModule,
    LicensingModule,
    TypeOrmModule.forFeature([
      Athlete,
      Guardian,
      GuardianPortalAccess,
      AthleteGuardian,
      AthleteTeamMembership,
      ClubGroup,
      Team,
      AthleteCharge,
      TrainingSession,
      PrivateLesson,
      SavedFilterPreset,
      OutreachActivity,
      StaffUser,
      Tenant,
      TenantCommunicationConfig,
    ]),
  ],
  controllers: [CommunicationController],
  providers: [
    CommunicationService,
    OutreachService,
    AssistedDeliveryProvider,
    {
      provide: WHATSAPP_CLOUD_API_FETCHER,
      useValue: defaultWhatsAppFetcher,
    },
    WhatsAppCloudApiClient,
    WhatsAppCloudApiProvider,
    WhatsAppReadinessService,
    CommunicationDeliveryService,
  ],
  exports: [
    CommunicationService,
    OutreachService,
    CommunicationDeliveryService,
    WhatsAppReadinessService,
  ],
})
export class CommunicationModule {}
