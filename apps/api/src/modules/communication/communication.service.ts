import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { SavedFilterPreset } from '../../database/entities/saved-filter-preset.entity';
import { Team } from '../../database/entities/team.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { GuardianPortalAccess } from '../../database/entities/guardian-portal-access.entity';
import { AthleteStatus, FamilyReadinessStatus } from '../../database/enums';
import { FinanceService } from '../finance/finance.service';
import { FamilyActionService } from '../family-action/family-action.service';
import { isRelationTableMissingError } from '../core/database-error.util';
import { ListCommunicationAudienceQueryDto } from './dto/list-communication-audience-query.dto';

type AudienceMember = {
  athleteId: string;
  athleteName: string;
  athleteStatus: AthleteStatus;
  reasons: string[];
  groupId: string | null;
  groupName: string | null;
  teamIds: string[];
  teamNames: string[];
  guardians: Array<{
    guardianId: string;
    name: string;
    relationshipType: string;
    phone: string | null;
    email: string | null;
    isPrimaryContact: boolean;
  }>;
  outstandingAmount: string;
  overdueAmount: string;
  hasOverdueBalance: boolean;
  familyReadinessStatus: FamilyReadinessStatus;
  pendingFamilyActions: number;
  awaitingStaffReview: number;
};

@Injectable()
export class CommunicationService {
  constructor(
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(Guardian)
    private readonly guardians: Repository<Guardian>,
    @InjectRepository(AthleteGuardian)
    private readonly athleteGuardians: Repository<AthleteGuardian>,
    @InjectRepository(AthleteTeamMembership)
    private readonly teamMemberships: Repository<AthleteTeamMembership>,
    @InjectRepository(ClubGroup)
    private readonly groups: Repository<ClubGroup>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(TrainingSession)
    private readonly trainingSessions: Repository<TrainingSession>,
    @InjectRepository(PrivateLesson)
    private readonly privateLessons: Repository<PrivateLesson>,
    @InjectRepository(SavedFilterPreset)
    private readonly presets: Repository<SavedFilterPreset>,
    @InjectRepository(GuardianPortalAccess)
    private readonly guardianPortalAccesses: Repository<GuardianPortalAccess>,
    private readonly finance: FinanceService,
    private readonly familyActions: FamilyActionService,
  ) {}

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
  }

  private async safeListPortalAccesses(tenantId: string): Promise<Array<Pick<GuardianPortalAccess, 'guardianId' | 'status'>>> {
    try {
      return await this.guardianPortalAccesses.find({
        where: { tenantId },
        select: { guardianId: true, status: true },
      });
    } catch (error) {
      if (isRelationTableMissingError(error)) {
        return [];
      }
      throw error;
    }
  }

  private async getCandidateAthleteIds(
    tenantId: string,
    query: ListCommunicationAudienceQueryDto,
  ): Promise<string[]> {
    const ids = new Set<string>();

    if (query.groupId) {
      const groupAthletes = await this.athletes.find({
        where: { tenantId, primaryGroupId: query.groupId },
        select: { id: true },
      });
      groupAthletes.forEach((athlete) => ids.add(athlete.id));
    }

    if (query.teamId) {
      const memberships = await this.teamMemberships.find({
        where: { tenantId, teamId: query.teamId, endedAt: IsNull() },
        select: { athleteId: true },
      });
      memberships.forEach((membership) => ids.add(membership.athleteId));
    }

    if (query.trainingSessionId) {
      const session = await this.trainingSessions.findOne({
        where: { tenantId, id: query.trainingSessionId },
      });
      if (session) {
        const athleteRows = await this.athletes.find({
          where: { tenantId, primaryGroupId: session.groupId },
          select: { id: true },
        });
        const scopedIds = session.teamId
          ? (
              await this.teamMemberships.find({
                where: { tenantId, teamId: session.teamId, endedAt: IsNull() },
                select: { athleteId: true },
              })
            ).map((row) => row.athleteId)
          : athleteRows.map((athlete) => athlete.id);
        athleteRows
          .filter((athlete) => !session.teamId || scopedIds.includes(athlete.id))
          .forEach((athlete) => ids.add(athlete.id));
      }
    }

    if (query.privateLessonId) {
      const lesson = await this.privateLessons.findOne({
        where: { tenantId, id: query.privateLessonId },
        select: { athleteId: true },
      });
      if (!lesson) {
        throw new BadRequestException('Private lesson not found');
      }
      ids.add(lesson.athleteId);
    }

    if (query.privateLessonStatus || query.privateLessonFrom || query.privateLessonTo || query.coachId) {
      const qb = this.privateLessons
        .createQueryBuilder('lesson')
        .where('lesson.tenantId = :tenantId', { tenantId });
      if (query.privateLessonStatus) {
        qb.andWhere('lesson.status = :status', { status: query.privateLessonStatus });
      }
      if (query.privateLessonFrom) {
        qb.andWhere('lesson.scheduledStart >= :from', { from: new Date(query.privateLessonFrom) });
      }
      if (query.privateLessonTo) {
        qb.andWhere('lesson.scheduledStart <= :to', { to: new Date(query.privateLessonTo) });
      }
      if (query.coachId) {
        qb.andWhere('lesson.coachId = :coachId', { coachId: query.coachId });
      }
      const lessons = await qb.select(['lesson.athleteId']).getMany();
      lessons.forEach((lesson) => ids.add(lesson.athleteId));
    }

    if (query.athleteIds && query.athleteIds.length > 0) {
      query.athleteIds.forEach((id) => ids.add(id));
    }

    if (query.financialState === 'overdue' || query.financialState === 'outstanding') {
      const financeSummary = await this.finance.listAthleteFinanceSummaries(tenantId, {});
      financeSummary.athletes
        .filter((row) => (query.financialState === 'overdue' ? row.totalOverdue > 0 : row.totalOutstanding > 0))
        .forEach((row) => ids.add(row.athlete.id));
    }

    if (query.familyReadiness || query.needsFollowUp) {
      const readinessMap = await this.familyActions.getReadinessMap(tenantId);
      for (const readiness of readinessMap.values()) {
        if (query.familyReadiness && readiness.status !== query.familyReadiness) {
          continue;
        }
        if (query.needsFollowUp && readiness.status === FamilyReadinessStatus.COMPLETE) {
          continue;
        }
        ids.add(readiness.athleteId);
      }
    }

    if (query.portalEnabledOnly || query.portalPendingOnly) {
      const accessRows = await this.safeListPortalAccesses(tenantId);
      const guardianIds = accessRows
        .filter((row) =>
          query.portalEnabledOnly
            ? row.status === 'active' || row.status === 'invited'
            : row.status === 'invited',
        )
        .map((row) => row.guardianId);
      if (guardianIds.length === 0) {
        return [];
      }
      const links = await this.athleteGuardians.find({
        where: { tenantId, guardianId: In(guardianIds) },
        select: { athleteId: true },
      });
      links.forEach((link) => ids.add(link.athleteId));
    }

    if (ids.size === 0) {
      const athletes = await this.athletes.find({
        where: { tenantId, ...(query.athleteStatus ? { status: query.athleteStatus } : {}) },
        order: { lastName: 'ASC', firstName: 'ASC' },
        take: 200,
        select: { id: true },
      });
      athletes.forEach((athlete) => ids.add(athlete.id));
    }

    return Array.from(ids);
  }

  async listAudience(tenantId: string, query: ListCommunicationAudienceQueryDto) {
    const athleteIds = await this.getCandidateAthleteIds(tenantId, query);
    if (athleteIds.length === 0) {
      return {
        items: [],
        counts: { athletes: 0, guardians: 0, primaryContacts: 0, withOverdueBalance: 0 },
      };
    }

    const [athletes, guardians, memberships, groups, teams, financeSummary, upcomingLessons, readinessMap, portalAccesses] =
      await Promise.all([
        this.athletes.find({
          where: { tenantId, id: In(athleteIds) },
          relations: ['primaryGroup'],
          order: { lastName: 'ASC', firstName: 'ASC' },
        }),
        this.athleteGuardians.find({
          where: { tenantId, athleteId: In(athleteIds) },
          relations: ['guardian'],
          order: { isPrimaryContact: 'DESC', createdAt: 'ASC' },
        }),
        this.teamMemberships.find({
          where: { tenantId, athleteId: In(athleteIds), endedAt: IsNull() },
          relations: ['team'],
        }),
        this.groups.find({ where: { tenantId } }),
        this.teams.find({ where: { tenantId } }),
        this.finance.listAthleteFinanceSummaries(tenantId, {}),
        this.privateLessons.find({
          where: { tenantId, athleteId: In(athleteIds) },
          relations: ['coach'],
          order: { scheduledStart: 'ASC' },
        }),
        this.familyActions.getReadinessMap(tenantId, athleteIds),
        this.safeListPortalAccesses(tenantId),
      ]);

    const financeMap = new Map(financeSummary.athletes.map((row) => [row.athlete.id, row]));
    const guardiansByAthlete = new Map<string, AthleteGuardian[]>();
    guardians.forEach((link) => {
      const current = guardiansByAthlete.get(link.athleteId) ?? [];
      current.push(link);
      guardiansByAthlete.set(link.athleteId, current);
    });
    const portalStatusByGuardian = new Map(portalAccesses.map((row) => [row.guardianId, row.status]));

    const membershipsByAthlete = new Map<string, AthleteTeamMembership[]>();
    memberships.forEach((membership) => {
      const current = membershipsByAthlete.get(membership.athleteId) ?? [];
      current.push(membership);
      membershipsByAthlete.set(membership.athleteId, current);
    });

    const lessonsByAthlete = new Map<string, PrivateLesson[]>();
    upcomingLessons.forEach((lesson) => {
      const current = lessonsByAthlete.get(lesson.athleteId) ?? [];
      current.push(lesson);
      lessonsByAthlete.set(lesson.athleteId, current);
    });

    const groupMap = new Map(groups.map((group) => [group.id, group.name]));
    const teamMap = new Map(teams.map((team) => [team.id, team.name]));

    let items: AudienceMember[] = athletes.map((athlete) => {
      const financeRow = financeMap.get(athlete.id);
      const activeMemberships = membershipsByAthlete.get(athlete.id) ?? [];
      const athleteLessons = lessonsByAthlete.get(athlete.id) ?? [];
      const readiness = readinessMap.get(athlete.id);
      const reasons: string[] = [];

      if (query.groupId && athlete.primaryGroupId === query.groupId) {
        reasons.push(`group:${groupMap.get(query.groupId) ?? query.groupId}`);
      }
      if (query.teamId && activeMemberships.some((membership) => membership.teamId === query.teamId)) {
        reasons.push(`team:${teamMap.get(query.teamId) ?? query.teamId}`);
      }
      if (query.financialState === 'overdue' && (financeRow?.totalOverdue ?? 0) > 0) {
        reasons.push('finance:overdue');
      }
      if (query.financialState === 'outstanding' && (financeRow?.totalOutstanding ?? 0) > 0) {
        reasons.push('finance:outstanding');
      }
      if (query.privateLessonStatus && athleteLessons.some((lesson) => lesson.status === query.privateLessonStatus)) {
        reasons.push(`private_lesson:${query.privateLessonStatus}`);
      }
      if (query.trainingSessionId) {
        reasons.push('training_session');
      }
      if (query.coachId && athleteLessons.some((lesson) => lesson.coachId === query.coachId)) {
        reasons.push('coach_assignment');
      }
      if (query.familyReadiness && readiness?.status === query.familyReadiness) {
        reasons.push(`family_readiness:${query.familyReadiness}`);
      }
      if (query.athleteStatus && athlete.status === query.athleteStatus) {
        reasons.push(`athlete_status:${query.athleteStatus}`);
      }
      if (
        query.portalEnabledOnly &&
        (guardiansByAthlete.get(athlete.id) ?? []).some((link) => {
          const status = portalStatusByGuardian.get(link.guardianId);
          return status === 'active' || status === 'invited';
        })
      ) {
        reasons.push('portal:enabled');
      }
      if (
        query.portalPendingOnly &&
        (guardiansByAthlete.get(athlete.id) ?? []).some(
          (link) => portalStatusByGuardian.get(link.guardianId) === 'invited',
        )
      ) {
        reasons.push('portal:pending');
      }
      if (query.needsFollowUp && readiness && readiness.status !== FamilyReadinessStatus.COMPLETE) {
        reasons.push(`family_readiness:${readiness.status}`);
      }
      if ((readiness?.summary.pendingFamilyActions ?? 0) > 0) {
        reasons.push('family_action:pending');
      }
      if ((readiness?.summary.awaitingStaffReview ?? 0) > 0) {
        reasons.push('family_action:review');
      }
      if (reasons.length === 0) {
        reasons.push('manual_selection');
      }

      return {
        athleteId: athlete.id,
        athleteName: [athlete.preferredName || athlete.firstName, athlete.lastName].filter(Boolean).join(' '),
        athleteStatus: athlete.status,
        reasons: this.unique(reasons),
        groupId: athlete.primaryGroupId,
        groupName: athlete.primaryGroup?.name ?? null,
        teamIds: this.unique(activeMemberships.map((membership) => membership.teamId)),
        teamNames: this.unique(activeMemberships.map((membership) => membership.team?.name ?? '')),
        guardians: (guardiansByAthlete.get(athlete.id) ?? []).map((link) => ({
          guardianId: link.guardian.id,
          name: `${link.guardian.firstName} ${link.guardian.lastName}`,
          relationshipType: link.relationshipType,
          phone: link.guardian.phone,
          email: link.guardian.email,
          isPrimaryContact: link.isPrimaryContact,
        })),
        outstandingAmount: (financeRow?.totalOutstanding ?? 0).toFixed(2),
        overdueAmount: (financeRow?.totalOverdue ?? 0).toFixed(2),
        hasOverdueBalance: (financeRow?.totalOverdue ?? 0) > 0,
        familyReadinessStatus: readiness?.status ?? FamilyReadinessStatus.COMPLETE,
        pendingFamilyActions: readiness?.summary.pendingFamilyActions ?? 0,
        awaitingStaffReview: readiness?.summary.awaitingStaffReview ?? 0,
      };
    });

    if (query.familyReadiness) {
      items = items.filter((item) => item.familyReadinessStatus === query.familyReadiness);
    }
    if (query.needsFollowUp) {
      items = items.filter((item) => item.familyReadinessStatus !== FamilyReadinessStatus.COMPLETE);
    }
    if (query.athleteStatus) {
      items = items.filter((item) => item.athleteStatus === query.athleteStatus);
    }

    if (query.q?.trim()) {
      const term = query.q.trim().toLowerCase();
      items = items.filter(
        (item) =>
          item.athleteName.toLowerCase().includes(term) ||
          item.groupName?.toLowerCase().includes(term) ||
          item.teamNames.some((name) => name.toLowerCase().includes(term)) ||
          item.guardians.some(
            (guardian) =>
              guardian.name.toLowerCase().includes(term) ||
              guardian.phone?.toLowerCase().includes(term) ||
              guardian.email?.toLowerCase().includes(term),
          ),
      );
    }

    if (query.primaryContactsOnly) {
      items = items
        .map((item) => ({
          ...item,
          guardians: item.guardians.filter((guardian) => guardian.isPrimaryContact),
        }))
        .filter((item) => item.guardians.length > 0);
    }

    if (query.portalEnabledOnly) {
      items = items.filter((item) =>
        item.guardians.some((guardian) => {
          const status = portalStatusByGuardian.get(guardian.guardianId);
          return status === 'active' || status === 'invited';
        }),
      );
    }
    if (query.portalPendingOnly) {
      items = items.filter((item) =>
        item.guardians.some((guardian) => portalStatusByGuardian.get(guardian.guardianId) === 'invited'),
      );
    }

    const guardianCount = items.reduce((sum, item) => sum + item.guardians.length, 0);
    const primaryContacts = items.reduce(
      (sum, item) => sum + item.guardians.filter((guardian) => guardian.isPrimaryContact).length,
      0,
    );

    return {
      items,
      counts: {
        athletes: items.length,
        guardians: guardianCount,
        primaryContacts,
        withOverdueBalance: items.filter((item) => item.hasOverdueBalance).length,
        incompleteAthletes: items.filter((item) => item.familyReadinessStatus === FamilyReadinessStatus.INCOMPLETE).length,
        awaitingGuardianAction: items.filter(
          (item) => item.familyReadinessStatus === FamilyReadinessStatus.AWAITING_GUARDIAN_ACTION,
        ).length,
        awaitingStaffReview: items.filter(
          (item) => item.familyReadinessStatus === FamilyReadinessStatus.AWAITING_STAFF_REVIEW,
        ).length,
        needingFollowUp: items.filter((item) => item.familyReadinessStatus !== FamilyReadinessStatus.COMPLETE).length,
      },
    };
  }

  async listAudienceSafe(tenantId: string, query: ListCommunicationAudienceQueryDto) {
    try {
      return await this.listAudience(tenantId, query);
    } catch (error) {
      if (isRelationTableMissingError(error)) {
        return {
          items: [],
          counts: {
            athletes: 0,
            guardians: 0,
            primaryContacts: 0,
            withOverdueBalance: 0,
            incompleteAthletes: 0,
            awaitingGuardianAction: 0,
            awaitingStaffReview: 0,
            needingFollowUp: 0,
          },
        };
      }
      throw error;
    }
  }

  async listPresets(tenantId: string) {
    return this.presets.find({
      where: { tenantId, surface: 'communications' },
      order: { updatedAt: 'DESC' },
    });
  }

  async savePreset(
    tenantId: string,
    name: string,
    payload: Record<string, unknown>,
    presetId?: string,
  ): Promise<SavedFilterPreset> {
    const existing = presetId
      ? await this.presets.findOne({ where: { tenantId, id: presetId, surface: 'communications' } })
      : null;
    const row =
      existing ??
      this.presets.create({
        tenantId,
        surface: 'communications',
      });
    row.name = name;
    row.payload = payload;
    return this.presets.save(row);
  }
}
