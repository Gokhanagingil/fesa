import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { IsNull, Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { GuardianPortalAccess } from '../../database/entities/guardian-portal-access.entity';
import { GuardianPortalSession } from '../../database/entities/guardian-portal-session.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { Team } from '../../database/entities/team.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { AthleteTeamMembership } from '../../database/entities/athlete-team-membership.entity';
import { FamilyActionService } from '../family-action/family-action.service';
import { FinanceService } from '../finance/finance.service';
import { InventoryService } from '../inventory/inventory.service';
import { TenantService } from '../tenant/tenant.service';
import { TenantBrandingService } from '../tenant/tenant-branding.service';
import { ClubUpdateService } from '../club-update/club-update.service';
import { ParentAudienceSet } from '../club-update/club-update.types';
import { GUARDIAN_PORTAL_SESSION_COOKIE } from './guardian-portal.constants';
import {
  InviteDeliveryAttempt,
  InviteDeliveryReadiness,
  InviteDeliveryService,
} from './invite-delivery.service';

type AccessStatus = GuardianPortalAccess['status'];

type SessionContext = {
  tenantId: string;
  accessId: string;
  guardianId: string;
  sessionId: string;
};

type ActivationOverviewItem = {
  guardianId: string;
  guardianName: string;
  email: string | null;
  linkedAthletes: number;
  inviteAgeDays: number | null;
  lastSeenAgeDays: number | null;
  status: AccessStatus | null;
  recoveryRequestedAt?: Date | null;
  recoveryRequestCount?: number;
};

type ActivationOverviewBucket = {
  count: number;
  items: ActivationOverviewItem[];
};

type ActivationOverview = {
  tenantId: string;
  generatedAt: Date;
  thresholds: {
    dormantAfterDays: number;
    staleInviteAfterDays: number;
  };
  totals: {
    guardians: number;
    guardiansWithAccess: number;
    notInvited: number;
    invited: number;
    active: number;
    dormant: number;
    recovery: number;
    disabled: number;
    recentlyActivated: number;
    staleInvites: number;
    activationRatePercent: number;
  };
  buckets: {
    notInvited: ActivationOverviewBucket;
    invited: ActivationOverviewBucket;
    active: ActivationOverviewBucket;
    dormant: ActivationOverviewBucket;
    recovery: ActivationOverviewBucket;
    disabled: ActivationOverviewBucket;
  };
};

/**
 * Parent Invite Delivery & Access Reliability Pack — truthful invite
 * delivery state surfaced to staff. We never imply an invite was
 * delivered; the UI renders one of these states verbatim.
 */
export type InviteDeliveryStateValue =
  | 'pending'
  | 'sent'
  | 'failed'
  | 'shared_manually'
  | 'unavailable';

export type InviteDeliverySummary = {
  state: InviteDeliveryStateValue | null;
  provider: string | null;
  detail: string | null;
  attemptedAt: Date | null;
  deliveredAt: Date | null;
  sharedAt: Date | null;
  attemptCount: number;
  /** Pre-rendered i18n key the staff UI uses for the calm tone copy. */
  toneKey:
    | 'pages.guardians.portalAccess.deliveryTone.sent'
    | 'pages.guardians.portalAccess.deliveryTone.failed'
    | 'pages.guardians.portalAccess.deliveryTone.unavailable'
    | 'pages.guardians.portalAccess.deliveryTone.sharedManually'
    | 'pages.guardians.portalAccess.deliveryTone.pending';
};

type GuardianAccessSummary = {
  id: string;
  guardianId: string;
  guardianName: string;
  guardianEmail: string | null;
  status: AccessStatus;
  invitedAt: Date | null;
  activatedAt: Date | null;
  lastLoginAt: Date | null;
  portalEnabled: boolean;
  pendingActions: number;
  awaitingReview: number;
  linkedAthletes: number;
  /** Parent Invite Delivery & Access Reliability Pack — truthful state. */
  inviteDelivery: InviteDeliverySummary;
  /**
   * Parent Portal v1.2 — recovery surface.
   *
   * Stamped from the public "I lost access" form so staff can spot,
   * from the existing access summary, when a family asked for help.
   * `recoveryRequestedAt` resets to null whenever staff resends an
   * invite (which is the canonical way to give the family a fresh
   * activation link).
   */
  recoveryRequestedAt: Date | null;
  recoveryRequestCount: number;
};

@Injectable()
export class GuardianPortalService {
  private readonly inviteTtlHours = 72;
  private readonly sessionTtlDays = 14;
  private readonly pbkdf2Iterations = 120_000;

  constructor(
    @InjectRepository(GuardianPortalAccess)
    private readonly accesses: Repository<GuardianPortalAccess>,
    @InjectRepository(GuardianPortalSession)
    private readonly sessions: Repository<GuardianPortalSession>,
    @InjectRepository(Guardian)
    private readonly guardians: Repository<Guardian>,
    @InjectRepository(AthleteGuardian)
    private readonly athleteGuardians: Repository<AthleteGuardian>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(TrainingSession)
    private readonly trainingSessions: Repository<TrainingSession>,
    @InjectRepository(PrivateLesson)
    private readonly privateLessons: Repository<PrivateLesson>,
    @InjectRepository(ClubGroup)
    private readonly groups: Repository<ClubGroup>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(AthleteTeamMembership)
    private readonly teamMemberships: Repository<AthleteTeamMembership>,
    private readonly familyActions: FamilyActionService,
    private readonly finance: FinanceService,
    private readonly inventory: InventoryService,
    private readonly tenants: TenantService,
    private readonly branding: TenantBrandingService,
    private readonly clubUpdates: ClubUpdateService,
    private readonly config: ConfigService,
    private readonly inviteDelivery: InviteDeliveryService,
  ) {}

  getInviteDeliveryReadiness(): InviteDeliveryReadiness {
    return this.inviteDelivery.getReadiness();
  }

  async verifyInviteDelivery(): Promise<InviteDeliveryReadiness> {
    return this.inviteDelivery.verifyDelivery();
  }

  /**
   * Build the absolute activation URL the parent will see in the
   * outgoing email. Falls back to the relative path the staff UI
   * already renders when no public origin is configured — the manual
   * share fallback works either way.
   */
  buildAbsoluteInviteLink(token: string): string {
    const origin = (this.config.get<string>('PORTAL_PUBLIC_ORIGIN') ?? '').trim();
    const path = this.buildInviteLink(token);
    if (!origin) return path;
    const trimmed = origin.endsWith('/') ? origin.slice(0, -1) : origin;
    return `${trimmed}${path}`;
  }

  private buildInviteDeliverySummary(access: GuardianPortalAccess): InviteDeliverySummary {
    const state = (access.inviteDeliveryState ?? null) as
      | InviteDeliveryStateValue
      | null;
    const toneKey: InviteDeliverySummary['toneKey'] = (() => {
      switch (state) {
        case 'sent':
          return 'pages.guardians.portalAccess.deliveryTone.sent';
        case 'failed':
          return 'pages.guardians.portalAccess.deliveryTone.failed';
        case 'unavailable':
          return 'pages.guardians.portalAccess.deliveryTone.unavailable';
        case 'shared_manually':
          return 'pages.guardians.portalAccess.deliveryTone.sharedManually';
        case 'pending':
        default:
          return 'pages.guardians.portalAccess.deliveryTone.pending';
      }
    })();
    return {
      state,
      provider: access.inviteDeliveryProvider ?? null,
      detail: access.inviteDeliveryDetail ?? null,
      attemptedAt: access.inviteDeliveryAttemptedAt ?? null,
      deliveredAt: access.inviteDeliveredAt ?? null,
      sharedAt: access.inviteSharedAt ?? null,
      attemptCount: access.inviteAttemptCount ?? 0,
      toneKey,
    };
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const nextSalt = salt ?? randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, nextSalt, this.pbkdf2Iterations, 64, 'sha512').toString('hex');
    return { hash, salt: nextSalt };
  }

  private verifyPassword(password: string, hash: string, salt: string): boolean {
    const next = pbkdf2Sync(password, salt, this.pbkdf2Iterations, 64, 'sha512');
    const current = Buffer.from(hash, 'hex');
    return current.length === next.length && timingSafeEqual(current, next);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private parseCookies(req: Request): Record<string, string> {
    const header = req.headers.cookie;
    if (!header) {
      return {};
    }
    return header.split(';').reduce<Record<string, string>>((acc, pair) => {
      const [key, ...rest] = pair.trim().split('=');
      if (!key || rest.length === 0) {
        return acc;
      }
      acc[key] = decodeURIComponent(rest.join('='));
      return acc;
    }, {});
  }

  private getGuardianName(guardian: Guardian): string {
    return `${guardian.firstName} ${guardian.lastName}`;
  }

  private getInviteExpiry(): Date {
    const date = new Date();
    date.setHours(date.getHours() + this.inviteTtlHours);
    return date;
  }

  private getSessionExpiry(): Date {
    const date = new Date();
    date.setDate(date.getDate() + this.sessionTtlDays);
    return date;
  }

  getCookieName(): string {
    return GUARDIAN_PORTAL_SESSION_COOKIE;
  }

  getCookieOptions() {
    const nodeEnv = this.config.get<string>('NODE_ENV', 'development');
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: nodeEnv === 'production' || nodeEnv === 'staging',
      path: '/',
      maxAge: this.sessionTtlDays * 24 * 60 * 60 * 1000,
    };
  }

  readSessionToken(req: Request): string | undefined {
    const cookies = this.parseCookies(req);
    return cookies[this.getCookieName()];
  }

  writeSessionCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(this.getCookieName(), token, {
      ...this.getCookieOptions(),
      expires: expiresAt,
    });
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(this.getCookieName(), {
      ...this.getCookieOptions(),
      maxAge: undefined,
      expires: undefined,
    });
  }

  async listTenants() {
    return this.branding.listPublicBranding();
  }

  async getTenantBranding(tenantId: string) {
    return this.branding.getForTenant(tenantId);
  }

  private async assertGuardian(tenantId: string, guardianId: string): Promise<Guardian> {
    const guardian = await this.guardians.findOne({ where: { id: guardianId, tenantId } });
    if (!guardian) {
      throw new NotFoundException('Guardian not found');
    }
    return guardian;
  }

  private async findAccessByGuardian(tenantId: string, guardianId: string): Promise<GuardianPortalAccess | null> {
    return this.accesses.findOne({
      where: { tenantId, guardianId },
      relations: ['guardian'],
    });
  }

  private async findAccessById(tenantId: string, accessId: string): Promise<GuardianPortalAccess> {
    const access = await this.accesses.findOne({
      where: { tenantId, id: accessId },
      relations: ['guardian'],
    });
    if (!access) {
      throw new NotFoundException('Guardian portal access not found');
    }
    return access;
  }

  private buildInviteLink(token: string): string {
    return `/portal/activate?token=${encodeURIComponent(token)}`;
  }

  private buildAccessSummary(
    access: GuardianPortalAccess,
    readiness: Awaited<ReturnType<FamilyActionService['getGuardianReadiness']>>,
  ): GuardianAccessSummary {
    return {
      id: access.id,
      guardianId: access.guardianId,
      guardianName: access.guardian ? this.getGuardianName(access.guardian) : access.guardianId,
      guardianEmail: access.email,
      status: access.status,
      invitedAt: access.invitedAt,
      activatedAt: access.activatedAt,
      lastLoginAt: access.lastLoginAt,
      portalEnabled: access.status !== 'disabled',
      pendingActions: readiness.actions.filter((item) =>
        ['open', 'pending_family_action', 'rejected'].includes(item.status),
      ).length,
      awaitingReview: readiness.actions.filter((item) =>
        ['submitted', 'under_review'].includes(item.status),
      ).length,
      linkedAthletes: readiness.summary.linkedAthletes,
      recoveryRequestedAt: access.recoveryRequestedAt ?? null,
      recoveryRequestCount: access.recoveryRequestCount ?? 0,
      inviteDelivery: this.buildInviteDeliverySummary(access),
    };
  }

  async listAccessSummary(tenantId: string): Promise<{ items: GuardianAccessSummary[]; total: number }> {
    const rows = await this.accesses.find({
      where: { tenantId },
      relations: ['guardian'],
      order: { updatedAt: 'DESC' },
    });
    const items = await Promise.all(
      rows.map(async (row) => {
        const readiness = await this.familyActions.getGuardianReadiness(tenantId, row.guardianId);
        return this.buildAccessSummary(row, readiness);
      }),
    );
    return { items, total: items.length };
  }

  /**
   * Family Activation & Landing Pack v1 — calm activation overview for staff.
   *
   * The Guardians → portal access surface already exposes a long list of
   * every guardian and their per-row state. Staff also need a calm, top-of-
   * page view that answers "where do families stand right now?" and "who
   * still needs a gentle nudge?". We compute that here from the same
   * source-of-truth (`guardian_portal_accesses` plus the linked guardian
   * row) so there is no second model to keep in sync.
   *
   * Buckets:
   *   - `notInvited`   — guardians with no portal access row yet but who
   *                      have an email on file. These are the "ready to
   *                      invite" families.
   *   - `invited`      — invite sent, not activated. Sub-bucketed by
   *                      `inviteAge` so staff can see who sat for a while.
   *   - `recovery`     — families who used the public "I lost access" form
   *                      and have not had a fresh invite sent yet.
   *   - `dormant`      — activated but not seen in the last 60 days. Calm,
   *                      not alarming — surfaced as "quiet" not "lapsed".
   *   - `disabled`     — staff has paused this access on purpose.
   *   - `active`       — activated and seen recently. Counted, not listed.
   *
   * Tenant isolation is preserved via the same `where: { tenantId, ... }`
   * clauses used everywhere else in this module.
   */
  async getActivationOverview(tenantId: string): Promise<ActivationOverview> {
    const dormantThresholdDays = 60;
    const now = Date.now();
    const dormantCutoff = now - dormantThresholdDays * 24 * 60 * 60 * 1000;

    const [accesses, guardians] = await Promise.all([
      this.accesses.find({
        where: { tenantId },
        relations: ['guardian'],
        order: { updatedAt: 'DESC' },
      }),
      this.guardians.find({ where: { tenantId } }),
    ]);

    const accessByGuardian = new Map(accesses.map((row) => [row.guardianId, row]));
    const linkCounts = await this.athleteGuardians
      .createQueryBuilder('link')
      .select('link.guardianId', 'guardianId')
      .addSelect('COUNT(link.id)', 'count')
      .where('link.tenantId = :tenantId', { tenantId })
      .groupBy('link.guardianId')
      .getRawMany<{ guardianId: string; count: string }>();
    const linkedByGuardian = new Map(linkCounts.map((row) => [row.guardianId, Number(row.count)]));

    const buckets: ActivationOverview['buckets'] = {
      active: { count: 0, items: [] },
      invited: { count: 0, items: [] },
      recovery: { count: 0, items: [] },
      dormant: { count: 0, items: [] },
      disabled: { count: 0, items: [] },
      notInvited: { count: 0, items: [] },
    };

    let recentlyActivated = 0;
    let staleInvite = 0;

    for (const guardian of guardians) {
      const access = accessByGuardian.get(guardian.id);
      const linkedAthletes = linkedByGuardian.get(guardian.id) ?? 0;

      if (!access) {
        if (linkedAthletes === 0) {
          continue;
        }
        if (!guardian.email) {
          continue;
        }
        buckets.notInvited.count += 1;
        if (buckets.notInvited.items.length < 25) {
          buckets.notInvited.items.push({
            guardianId: guardian.id,
            guardianName: this.getGuardianName(guardian),
            email: guardian.email,
            linkedAthletes,
            inviteAgeDays: null,
            lastSeenAgeDays: null,
            status: null,
          });
        }
        continue;
      }
    }

    for (const access of accesses) {
      const guardianName = access.guardian
        ? this.getGuardianName(access.guardian)
        : access.guardianId;
      const linkedAthletes = linkedByGuardian.get(access.guardianId) ?? 0;
      const inviteAgeDays = access.invitedAt
        ? Math.floor((now - access.invitedAt.getTime()) / (24 * 60 * 60 * 1000))
        : null;
      const lastSeenAgeDays = access.lastLoginAt
        ? Math.floor((now - access.lastLoginAt.getTime()) / (24 * 60 * 60 * 1000))
        : null;

      const baseItem: ActivationOverviewItem = {
        guardianId: access.guardianId,
        guardianName,
        email: access.email,
        linkedAthletes,
        inviteAgeDays,
        lastSeenAgeDays,
        status: access.status,
      };

      if (access.recoveryRequestedAt && access.status !== 'disabled') {
        buckets.recovery.count += 1;
        if (buckets.recovery.items.length < 25) {
          buckets.recovery.items.push({
            ...baseItem,
            recoveryRequestedAt: access.recoveryRequestedAt,
            recoveryRequestCount: access.recoveryRequestCount ?? 1,
          });
        }
        continue;
      }

      if (access.status === 'disabled') {
        buckets.disabled.count += 1;
        if (buckets.disabled.items.length < 25) {
          buckets.disabled.items.push(baseItem);
        }
        continue;
      }

      if (access.status === 'invited') {
        buckets.invited.count += 1;
        if ((inviteAgeDays ?? 0) >= 7) {
          staleInvite += 1;
        }
        if (buckets.invited.items.length < 25) {
          buckets.invited.items.push(baseItem);
        }
        continue;
      }

      if (access.status === 'active') {
        if (access.activatedAt && access.activatedAt.getTime() >= dormantCutoff) {
          recentlyActivated += 1;
        }
        const lastSignal = access.lastLoginAt ?? access.activatedAt;
        const isDormant = !lastSignal || lastSignal.getTime() < dormantCutoff;
        if (isDormant) {
          buckets.dormant.count += 1;
          if (buckets.dormant.items.length < 25) {
            buckets.dormant.items.push(baseItem);
          }
        } else {
          buckets.active.count += 1;
          if (buckets.active.items.length < 10) {
            buckets.active.items.push(baseItem);
          }
        }
      }
    }

    // Sort the staff-facing lists so the "most actionable" entries
    // float to the top of each bucket.
    buckets.invited.items.sort((a, b) => (b.inviteAgeDays ?? 0) - (a.inviteAgeDays ?? 0));
    buckets.dormant.items.sort((a, b) => (b.lastSeenAgeDays ?? 0) - (a.lastSeenAgeDays ?? 0));
    buckets.recovery.items.sort((a, b) => {
      const aTime = a.recoveryRequestedAt ? a.recoveryRequestedAt.getTime() : 0;
      const bTime = b.recoveryRequestedAt ? b.recoveryRequestedAt.getTime() : 0;
      return bTime - aTime;
    });

    const totalGuardians = guardians.length;
    const totalAccessRows = accesses.length;
    const totalActive = buckets.active.count + buckets.dormant.count;
    // Parent Access Stabilization Pass — the activation rate denominator
    // intentionally excludes paused (`disabled`) rows. Those families
    // were taken out of the active funnel by staff on purpose and
    // counting them as "didn't activate" gives a falsely pessimistic
    // number on the staff-side overview. Recovery rows still count
    // (they are families we are mid-helping, not paused).
    const denominator = Math.max(0, totalAccessRows - buckets.disabled.count);
    const activationRate =
      denominator > 0 ? Math.round((totalActive / denominator) * 100) : 0;

    return {
      tenantId,
      generatedAt: new Date(),
      thresholds: {
        dormantAfterDays: dormantThresholdDays,
        staleInviteAfterDays: 7,
      },
      totals: {
        guardians: totalGuardians,
        guardiansWithAccess: totalAccessRows,
        notInvited: buckets.notInvited.count,
        invited: buckets.invited.count,
        active: buckets.active.count,
        dormant: buckets.dormant.count,
        recovery: buckets.recovery.count,
        disabled: buckets.disabled.count,
        recentlyActivated,
        staleInvites: staleInvite,
        activationRatePercent: activationRate,
      },
      buckets,
    };
  }

  async getAccessSummary(tenantId: string, guardianId: string): Promise<GuardianAccessSummary | null> {
    const access = await this.findAccessByGuardian(tenantId, guardianId);
    if (!access) {
      return null;
    }
    const readiness = await this.familyActions.getGuardianReadiness(tenantId, guardianId);
    return this.buildAccessSummary(access, readiness);
  }

  async inviteGuardian(
    tenantId: string,
    guardianId: string,
    input: { email?: string | null; language?: 'en' | 'tr' },
  ): Promise<
    GuardianAccessSummary & {
      inviteLink: string;
      absoluteInviteLink: string;
      delivery: InviteDeliverySummary;
    }
  > {
    const guardian = await this.assertGuardian(tenantId, guardianId);
    const email = this.normalizeEmail(input.email ?? guardian.email ?? '');
    if (!email) {
      throw new BadRequestException('Guardian email is required before portal access can be invited');
    }

    const token = randomBytes(24).toString('hex');
    const inviteTokenHash = this.hashToken(token);
    const inviteTokenExpiresAt = this.getInviteExpiry();
    const now = new Date();

    let access = await this.findAccessByGuardian(tenantId, guardianId);
    const previousAttemptCount = access?.inviteAttemptCount ?? 0;
    if (!access) {
      access = this.accesses.create({
        tenantId,
        guardianId,
        email,
        status: 'invited',
        passwordHash: null,
        passwordSalt: null,
        inviteTokenHash,
        inviteTokenExpiresAt,
        invitedAt: now,
        activatedAt: null,
        lastLoginAt: null,
        disabledAt: null,
        inviteDeliveryState: 'pending',
        inviteDeliveryProvider: null,
        inviteDeliveryDetail: null,
        inviteDeliveryAttemptedAt: null,
        inviteDeliveredAt: null,
        inviteSharedAt: null,
        inviteAttemptCount: 1,
      });
    } else {
      access.email = email;
      access.status = access.status === 'disabled' ? 'invited' : access.status;
      access.inviteTokenHash = inviteTokenHash;
      access.inviteTokenExpiresAt = inviteTokenExpiresAt;
      access.invitedAt = now;
      access.disabledAt = null;
      // Parent Portal v1.2 — staff has now responded to the family,
      // so clear the recovery flag from the access summary surface.
      access.recoveryRequestedAt = null;
      access.recoveryRequestCount = 0;
      // Parent Invite Delivery & Access Reliability Pack — every fresh
      // (re)issue resets delivery state so the staff UI never carries a
      // stale "sent" badge over from a previous attempt.
      access.inviteDeliveryState = 'pending';
      access.inviteDeliveryProvider = null;
      access.inviteDeliveryDetail = null;
      access.inviteDeliveryAttemptedAt = null;
      access.inviteDeliveredAt = null;
      access.inviteSharedAt = null;
      access.inviteAttemptCount = previousAttemptCount + 1;
    }

    const saved = await this.accesses.save(access);

    const tenantName = saved.tenant?.name ?? null;
    const tenantNameForCopy =
      tenantName ?? (await this.tenants.findById(tenantId).then((t) => t?.name ?? 'Amateur'));
    const absoluteLink = this.buildAbsoluteInviteLink(token);
    const guardianName = this.getGuardianName(guardian);

    const attempt: InviteDeliveryAttempt = await this.inviteDelivery.sendInvite({
      toEmail: email,
      guardianName,
      tenantName: tenantNameForCopy,
      activationUrl: absoluteLink,
      expiresInHours: this.inviteTtlHours,
      language: input.language,
    });

    saved.inviteDeliveryProvider = attempt.provider;
    saved.inviteDeliveryDetail = attempt.detail;
    saved.inviteDeliveryAttemptedAt = attempt.attemptedAt;
    saved.inviteDeliveredAt = attempt.deliveredAt;
    saved.inviteDeliveryState = attempt.state;

    await this.accesses.save(saved);

    const hydrated = await this.findAccessById(tenantId, saved.id);
    const familyReadiness = await this.familyActions.getGuardianReadiness(tenantId, guardianId);
    const summary = this.buildAccessSummary(hydrated, familyReadiness);
    return {
      ...summary,
      inviteLink: this.buildInviteLink(token),
      absoluteInviteLink: absoluteLink,
      delivery: summary.inviteDelivery,
    };
  }

  /**
   * Parent Invite Delivery & Access Reliability Pack — manual fallback.
   *
   * Staff have already copied / shared the activation link themselves
   * (e.g. via WhatsApp, in person, on a printed page). We stamp the
   * row so the UI flips to a calm `shared_manually` badge instead of
   * leaving it on the alarming `unavailable` / `failed` state. We do
   * NOT mint a new token here — the existing invite token remains the
   * single source of truth for the activation page.
   */
  async markInviteShared(tenantId: string, accessId: string): Promise<GuardianAccessSummary> {
    const access = await this.findAccessById(tenantId, accessId);
    if (!access.inviteTokenHash) {
      throw new BadRequestException(
        'No active invite token to share — issue or resend an invite first.',
      );
    }
    access.inviteDeliveryState = 'shared_manually';
    access.inviteSharedAt = new Date();
    if (!access.inviteDeliveryProvider) {
      access.inviteDeliveryProvider = 'manual';
    }
    if (!access.inviteDeliveryDetail) {
      access.inviteDeliveryDetail = 'shared_by_staff';
    }
    await this.accesses.save(access);
    const familyReadiness = await this.familyActions.getGuardianReadiness(
      tenantId,
      access.guardianId,
    );
    return this.buildAccessSummary(access, familyReadiness);
  }

  async disableAccess(tenantId: string, accessId: string): Promise<GuardianAccessSummary> {
    const access = await this.findAccessById(tenantId, accessId);

    access.status = 'disabled';
    access.disabledAt = new Date();
    access.inviteTokenHash = null;
    access.inviteTokenExpiresAt = null;
    await this.accesses.save(access);
    await this.sessions.update(
      { tenantId, guardianPortalAccessId: access.id, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    const readiness = await this.familyActions.getGuardianReadiness(tenantId, access.guardianId);
    return this.buildAccessSummary(access, readiness);
  }

  async enableAccess(tenantId: string, accessId: string): Promise<GuardianAccessSummary & { inviteLink: string }> {
    const access = await this.findAccessById(tenantId, accessId);
    return this.inviteGuardian(tenantId, access.guardianId, { email: access.email });
  }

  async getActivationStatus(token: string) {
    const hash = this.hashToken(token);
    const access = await this.accesses.findOne({
      where: { inviteTokenHash: hash },
      relations: ['guardian', 'tenant'],
    });
    // Parent Access Stabilization Pass — distinguish "expired" from
    // "invalid" so the activation page can render the calmer copy. We
    // still 401 in both cases (tokens never leak account existence) but
    // we tag the error code so the parent-facing UI can pick warmer
    // wording. The two truthful codes the API uses are:
    //   - `invite_link_expired`  — token matched a row but the window
    //     elapsed (the family pasted an old link).
    //   - `invite_link_invalid`  — token did not match any row (typo,
    //     truncation, or the row was reissued / deleted).
    //   - `portal_access_disabled` — the row exists but staff paused it
    //     on purpose; recovery-via-staff is the right next step.
    if (!access) {
      throw new UnauthorizedException({
        message: 'Invite link is invalid',
        code: 'invite_link_invalid',
      });
    }
    if (!access.inviteTokenExpiresAt || access.inviteTokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        message: 'Invite link has expired',
        code: 'invite_link_expired',
      });
    }
    if (access.status === 'disabled') {
      throw new UnauthorizedException({
        message: 'Portal access is paused by the club',
        code: 'portal_access_disabled',
      });
    }

    const brand = await this.branding.getForTenant(access.tenantId);
    return {
      token,
      tenantId: access.tenantId,
      tenantName: access.tenant.name,
      guardianId: access.guardianId,
      guardianName: access.guardian ? this.getGuardianName(access.guardian) : access.guardianId,
      email: access.email,
      expiresAt: access.inviteTokenExpiresAt,
      branding: brand,
    };
  }

  async activate(token: string, input: { password: string }) {
    const password = input.password.trim();
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const hash = this.hashToken(token);
    const access = await this.accesses.findOne({
      where: { inviteTokenHash: hash },
      relations: ['guardian'],
    });
    if (!access) {
      throw new UnauthorizedException({
        message: 'Invite link is invalid',
        code: 'invite_link_invalid',
      });
    }
    if (!access.inviteTokenExpiresAt || access.inviteTokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({
        message: 'Invite link has expired',
        code: 'invite_link_expired',
      });
    }
    if (access.status === 'disabled') {
      throw new UnauthorizedException({
        message: 'Portal access is paused by the club',
        code: 'portal_access_disabled',
      });
    }

    const passwordInfo = this.hashPassword(password);
    const now = new Date();
    access.passwordHash = passwordInfo.hash;
    access.passwordSalt = passwordInfo.salt;
    access.status = 'active';
    access.activatedAt = access.activatedAt ?? now;
    access.inviteTokenHash = null;
    access.inviteTokenExpiresAt = null;
    access.disabledAt = null;
    access.lastLoginAt = now;
    // Parent Access Stabilization Pass — clear recovery flags on
    // successful activation. Without this, a family that triggered the
    // public "I lost access" form and then activated via the fresh
    // invite kept the recovery banner / staff badge on indefinitely.
    // The truth is now coherent: once they're inside, the help request
    // is resolved.
    access.recoveryRequestedAt = null;
    access.recoveryRequestCount = 0;
    // Parent Access Stabilization Pass — also clear the delivery state
    // so staff don't see a stale "Email sent" / "Shared manually" badge
    // for a row that has already been activated. The activated row
    // graduates out of the "did the invite reach them?" question
    // entirely.
    access.inviteDeliveryState = null;
    access.inviteDeliveryDetail = null;
    access.inviteDeliveryProvider = null;
    access.inviteDeliveryAttemptedAt = null;
    access.inviteDeliveredAt = null;
    access.inviteSharedAt = null;
    await this.accesses.save(access);

    const session = await this.createSession(access);
    return {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      summary: await this.getPortalHome(access.tenantId, access.guardianId),
    };
  }

  /**
   * Parent Portal v1.2 — calm "I lost access" UX.
   *
   * The public response is intentionally identical for both
   * "we found you" and "we did not" cases so we never leak whether an
   * email exists in any tenant. When a row is found we stamp the
   * recovery columns so club staff can see, from the existing access
   * summary surface, that this family asked for help recently. The
   * actual reset still flows through the staff resend-invite path —
   * that keeps the recovery loop safely under club control without
   * forcing us to invent a new public reset link in v1.2.
   */
  async requestRecovery(input: { email: string; tenantId: string | null }): Promise<{
    submitted: true;
    helpMessageKey: 'portal.recovery.submitted';
  }> {
    const email = this.normalizeEmail(input.email);
    if (!email) {
      return { submitted: true, helpMessageKey: 'portal.recovery.submitted' };
    }
    const where = input.tenantId
      ? { tenantId: input.tenantId, email }
      : { email };
    const matches = await this.accesses.find({ where });
    const now = new Date();
    for (const access of matches) {
      access.recoveryRequestedAt = now;
      access.recoveryRequestCount = (access.recoveryRequestCount ?? 0) + 1;
      await this.accesses.save(access);
    }
    return { submitted: true, helpMessageKey: 'portal.recovery.submitted' };
  }

  async login(input: { email: string; password: string; tenantId: string }) {
    const normalizedEmail = this.normalizeEmail(input.email);
    const access = await this.accesses.findOne({
      where: { tenantId: input.tenantId, email: normalizedEmail },
      relations: ['guardian'],
    });
    if (!access || !access.passwordHash || !access.passwordSalt) {
      throw new UnauthorizedException('Invalid portal credentials');
    }
    if (access.status !== 'active') {
      throw new UnauthorizedException('Portal access is not active');
    }
    if (!this.verifyPassword(input.password, access.passwordHash, access.passwordSalt)) {
      throw new UnauthorizedException('Invalid portal credentials');
    }

    access.lastLoginAt = new Date();
    await this.accesses.save(access);
    const session = await this.createSession(access);
    return {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      summary: await this.getPortalHome(access.tenantId, access.guardianId),
    };
  }

  private async createSession(access: GuardianPortalAccess) {
    const rawToken = randomBytes(32).toString('hex');
    const session = this.sessions.create({
      tenantId: access.tenantId,
      guardianPortalAccessId: access.id,
      tokenHash: this.hashToken(rawToken),
      expiresAt: this.getSessionExpiry(),
      lastSeenAt: new Date(),
      revokedAt: null,
    });
    const saved = await this.sessions.save(session);
    return {
      token: rawToken,
      expiresAt: saved.expiresAt,
      guardianId: access.guardianId,
      accessId: access.id,
      tenantId: access.tenantId,
    };
  }

  async logout(tenantId: string, rawToken: string | undefined): Promise<void> {
    if (!rawToken) {
      return;
    }
    await this.sessions.update(
      { tenantId, tokenHash: this.hashToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  async getSessionContext(rawToken: string | undefined): Promise<SessionContext> {
    if (!rawToken) {
      throw new UnauthorizedException('Guardian session is required');
    }

    const hash = this.hashToken(rawToken);
    const session = await this.sessions.findOne({
      where: { tokenHash: hash },
      relations: ['access'],
    });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Guardian session is invalid or expired');
    }
    if (!session.access || session.access.status !== 'active') {
      throw new UnauthorizedException('Guardian session is not active');
    }

    session.lastSeenAt = new Date();
    await this.sessions.save(session);

    return {
      tenantId: session.tenantId,
      accessId: session.guardianPortalAccessId,
      guardianId: session.access.guardianId,
      sessionId: session.id,
    };
  }

  async getPortalHome(tenantId: string, guardianId: string) {
    const guardian = await this.assertGuardian(tenantId, guardianId);
    const access = await this.findAccessByGuardian(tenantId, guardianId);
    if (!access || access.status !== 'active') {
      throw new UnauthorizedException('Guardian portal access is not active');
    }

    const links = await this.athleteGuardians.find({
      where: { tenantId, guardianId },
      relations: ['athlete', 'athlete.primaryGroup', 'guardian'],
      order: { isPrimaryContact: 'DESC', createdAt: 'ASC' },
    });
    const athleteIds = links.map((link) => link.athleteId);
    const readiness = await this.familyActions.getGuardianReadiness(tenantId, guardianId);
    const financeSummary = athleteIds.length
      ? await this.finance.listAthleteFinanceSummaries(tenantId, {})
      : {
          athletes: [] as Awaited<
            ReturnType<FinanceService['listAthleteFinanceSummaries']>
          >['athletes'],
          charges: [] as Awaited<
            ReturnType<FinanceService['listAthleteFinanceSummaries']>
          >['charges'],
          recentPayments: [] as Awaited<
            ReturnType<FinanceService['listAthleteFinanceSummaries']>
          >['recentPayments'],
          totals: {
            totalCharged: '0.00',
            totalCollected: '0.00',
            totalOutstanding: '0.00',
            totalOverdue: '0.00',
          },
        };
    const financeByAthlete = new Map(
      financeSummary.athletes
        .filter((row) => athleteIds.includes(row.athlete.id))
        .map((row) => [row.athlete.id, row]),
    );
    const [upcomingTraining, upcomingLessons, teams] = await Promise.all([
      athleteIds.length
        ? this.trainingSessions
            .createQueryBuilder('session')
            .where('session.tenantId = :tenantId', { tenantId })
            .andWhere('session.scheduledStart >= :now', { now: new Date() })
            .orderBy('session.scheduledStart', 'ASC')
            .take(20)
            .getMany()
        : Promise.resolve([]),
      athleteIds.length
        ? this.privateLessons.find({
            where: athleteIds.map((athleteId) => ({ tenantId, athleteId })),
            relations: ['coach', 'athlete'],
            order: { scheduledStart: 'ASC' },
            take: 20,
          })
        : Promise.resolve([]),
      this.teams.find({ where: { tenantId } }),
    ]);

    const teamMap = new Map(teams.map((team) => [team.id, team]));

    // Parent Portal v1.2 — derived audience set across the whole family.
    // Athletes contribute their sport branch and primary group; their
    // open team memberships contribute teams. We use this for two
    // things: targeted club-updates filtering and the upcoming-week
    // schedule digest.
    const memberships = athleteIds.length
      ? await this.teamMemberships.find({
          where: athleteIds.map((athleteId) => ({ tenantId, athleteId })),
        })
      : [];
    const openMemberships = memberships.filter((row) => row.endedAt == null);
    const teamIdsForFamily = new Set<string>(openMemberships.map((row) => row.teamId));
    const audienceSet: ParentAudienceSet = {
      sportBranchIds: new Set(
        links
          .map((link) => link.athlete?.sportBranchId ?? null)
          .filter((id): id is string => Boolean(id)),
      ),
      groupIds: new Set(
        links
          .map((link) => link.athlete?.primaryGroupId ?? null)
          .filter((id): id is string => Boolean(id)),
      ),
      teamIds: teamIdsForFamily,
    };

    const visibleTraining = upcomingTraining.filter((session) => {
      const matchesGroup = links.some((link) => link.athlete?.primaryGroupId === session.groupId);
      if (!matchesGroup) return false;
      if (!session.teamId) return true;
      return teamIdsForFamily.has(session.teamId) || teamMap.has(session.teamId);
    });

    // Parent Portal v1.2 — inventory in hand per athlete (active only).
    // Pulled through the inventory service so the parent payload reuses
    // exactly the same active-assignment definition staff see.
    const inventoryByAthlete = new Map<string, Awaited<ReturnType<InventoryService['listAssignmentsForAthlete']>>>();
    if (athleteIds.length) {
      await Promise.all(
        athleteIds.map(async (athleteId) => {
          try {
            const items = await this.inventory.listAssignmentsForAthlete(tenantId, athleteId, {
              includeReturned: false,
            });
            inventoryByAthlete.set(athleteId, items);
          } catch {
            inventoryByAthlete.set(athleteId, []);
          }
        }),
      );
    }

    const linkedAthletes = links.map((link) => {
      const inventoryItems = inventoryByAthlete.get(link.athleteId) ?? [];
      return {
        linkId: link.id,
        athleteId: link.athleteId,
        relationshipType: link.relationshipType,
        isPrimaryContact: link.isPrimaryContact,
        athleteName: link.athlete
          ? `${link.athlete.preferredName || link.athlete.firstName} ${link.athlete.lastName}`
          : link.athleteId,
        groupName: link.athlete?.primaryGroup?.name ?? null,
        status: link.athlete?.status ?? null,
        outstandingAmount: financeByAthlete.get(link.athleteId)?.totalOutstanding.toFixed(2) ?? '0.00',
        overdueAmount: financeByAthlete.get(link.athleteId)?.totalOverdue.toFixed(2) ?? '0.00',
        nextTraining: visibleTraining
          .filter((session) => session.groupId === link.athlete?.primaryGroupId)
          .slice(0, 2)
          .map((session) => ({
            id: session.id,
            title: session.title,
            scheduledStart: session.scheduledStart,
          })),
        nextPrivateLesson:
          upcomingLessons
            .filter((lesson) => lesson.athleteId === link.athleteId)
            .slice(0, 1)
            .map((lesson) => ({
              id: lesson.id,
              scheduledStart: lesson.scheduledStart,
              coachName: lesson.coach
                ? `${lesson.coach.preferredName || lesson.coach.firstName} ${lesson.coach.lastName}`
                : null,
            }))[0] ?? null,
        inventoryInHand: inventoryItems
          .filter((row) => row.isOpen)
          .slice(0, 5)
          .map((row) => ({
            id: row.id,
            itemName: row.inventoryItemName,
            variantLabel: row.variantLabel,
            quantity: row.quantity,
            assignedAt: row.assignedAt,
          })),
      };
    });

    const [brand, clubUpdates] = await Promise.all([
      this.branding.getForTenant(tenantId),
      this.clubUpdates.listForParents(tenantId, audienceSet),
    ]);

    const todayBoundary = new Date();
    todayBoundary.setHours(23, 59, 59, 999);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayTraining = visibleTraining
      .filter((session) => session.scheduledStart >= todayStart && session.scheduledStart <= todayBoundary)
      .slice(0, 3)
      .map((session) => ({
        id: session.id,
        title: session.title,
        scheduledStart: session.scheduledStart,
        location: session.location,
      }));
    const todayLessons = upcomingLessons
      .filter((lesson) => lesson.scheduledStart >= todayStart && lesson.scheduledStart <= todayBoundary)
      .slice(0, 3)
      .map((lesson) => ({
        id: lesson.id,
        scheduledStart: lesson.scheduledStart,
        athleteId: lesson.athleteId,
        athleteName: lesson.athlete
          ? `${lesson.athlete.preferredName || lesson.athlete.firstName} ${lesson.athlete.lastName}`
          : lesson.athleteId,
        coachName: lesson.coach
          ? `${lesson.coach.preferredName || lesson.coach.firstName} ${lesson.coach.lastName}`
          : null,
      }));

    // Parent Portal v1.2 — "this week" family digest. Same data sources
    // as the per-athlete cards, just merged, sorted by start, and
    // capped at five entries so the home stays a calm, scannable column.
    const weekBoundary = new Date(todayStart);
    weekBoundary.setDate(weekBoundary.getDate() + 7);
    const weekTraining = visibleTraining
      .filter(
        (session) =>
          session.scheduledStart > todayBoundary && session.scheduledStart <= weekBoundary,
      )
      .map((session) => ({
        kind: 'training' as const,
        id: session.id,
        title: session.title ?? null,
        scheduledStart: session.scheduledStart,
        location: session.location ?? null,
        athleteId: null as string | null,
        athleteName: null as string | null,
        coachName: null as string | null,
      }));
    const weekLessons = upcomingLessons
      .filter(
        (lesson) =>
          lesson.scheduledStart > todayBoundary && lesson.scheduledStart <= weekBoundary,
      )
      .map((lesson) => ({
        kind: 'lesson' as const,
        id: lesson.id,
        title: null as string | null,
        scheduledStart: lesson.scheduledStart,
        location: lesson.location ?? null,
        athleteId: lesson.athleteId,
        athleteName: lesson.athlete
          ? `${lesson.athlete.preferredName || lesson.athlete.firstName} ${lesson.athlete.lastName}`
          : null,
        coachName: lesson.coach
          ? `${lesson.coach.preferredName || lesson.coach.firstName} ${lesson.coach.lastName}`
          : null,
      }));
    const weekItems = [...weekTraining, ...weekLessons]
      .sort((a, b) => a.scheduledStart.getTime() - b.scheduledStart.getTime())
      .slice(0, 5);

    // Family Activation & Landing Pack v1 — first-landing detection.
    // We treat a session as "first landing" when the access has been
    // activated within the last 14 days AND lastLoginAt is either null
    // or equal to activatedAt (which is the case immediately after the
    // activation flow stamps both columns at once). This is a calm,
    // honest signal — never marketing, never pressuring — and it's the
    // hint the parent home uses to render the warm welcome card and the
    // tiny "next 1–3 things" strip.
    const firstLandingWindowDays = 14;
    const firstLandingActive = Boolean(
      access.activatedAt &&
        access.activatedAt.getTime() >= Date.now() - firstLandingWindowDays * 24 * 60 * 60 * 1000 &&
        (!access.lastLoginAt ||
          Math.abs(access.lastLoginAt.getTime() - access.activatedAt.getTime()) < 60 * 1000),
    );

    // Family Activation & Landing Pack v1 — calm essentials surface.
    // We do NOT build a profile-completion gauntlet. Instead we surface
    // a tiny, honest checklist of the few things that matter most for a
    // newly-activated family. Each entry includes a stable `key`, a
    // `severity` ("info" or "attention"), and a `done` flag so the
    // portal can render a strikethrough or hide it. We do not surface
    // entries that would require a parent to learn a new flow.
    type Essential = {
      key: 'confirm_phone' | 'review_children' | 'open_pending_action' | 'check_balance';
      severity: 'info' | 'attention';
      done: boolean;
    };
    const pendingActionsForEssentials = readiness.actions.filter((item) =>
      ['open', 'pending_family_action', 'rejected'].includes(item.status),
    );
    const essentials: Essential[] = [
      {
        key: 'confirm_phone',
        severity: guardian.phone ? 'info' : 'attention',
        done: Boolean(guardian.phone),
      },
      {
        key: 'review_children',
        severity: linkedAthletes.length === 0 ? 'attention' : 'info',
        done: linkedAthletes.length > 0,
      },
      {
        key: 'open_pending_action',
        severity: pendingActionsForEssentials.length > 0 ? 'attention' : 'info',
        done: pendingActionsForEssentials.length === 0,
      },
      {
        key: 'check_balance',
        severity:
          linkedAthletes.some((athlete) => Number(athlete.overdueAmount) > 0) ? 'attention' : 'info',
        done: linkedAthletes.every((athlete) => Number(athlete.outstandingAmount) <= 0),
      },
    ];
    const essentialsAttention = essentials.filter((entry) => entry.severity === 'attention').length;

    // Parent Portal v1.3 — Payment Readiness layer.
    //
    // The intent is "calm, family-facing finance clarity" — never a
    // collections surface. We project the per-athlete charge slice into
    // a small, non-threatening shape that answers three questions for a
    // parent at a glance:
    //   1. Is anything genuinely past due right now?
    //   2. What is coming up next, and when?
    //   3. What is already settled / fine?
    //
    // We deliberately:
    //   - cap the visible charges at 6 across the whole family so the
    //     surface stays scannable on a phone;
    //   - never render `cancelled` or `paid` rows as "open";
    //   - group everything by athlete so the parent always sees who a
    //     given line concerns;
    //   - hand over a single resolved currency (defaulting to TRY) so
    //     the UI never has to invent one.
    type PaymentReadinessCharge = {
      id: string;
      athleteId: string;
      athleteName: string;
      itemName: string;
      amount: string;
      remainingAmount: string;
      dueDate: string | null;
      status: 'overdue' | 'dueSoon' | 'open';
      isOverdue: boolean;
      currency: string;
      billingPeriodLabel: string | null;
    };
    const SOON_WINDOW_DAYS = 14;
    const PARENT_FINANCE_CAP = 6;
    const familyChargeIds = new Set(athleteIds);
    const linkedAthleteNames = new Map(
      links.map((link) => [
        link.athleteId,
        link.athlete
          ? `${link.athlete.preferredName || link.athlete.firstName} ${link.athlete.lastName}`
          : link.athleteId,
      ]),
    );
    const familyCharges = (financeSummary.charges ?? []).filter((charge) =>
      familyChargeIds.has(charge.athleteId),
    );
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const soonBoundary = new Date(todayMidnight);
    soonBoundary.setDate(soonBoundary.getDate() + SOON_WINDOW_DAYS);
    let dominantCurrency = 'TRY';
    for (const charge of familyCharges) {
      const code = charge.chargeItem?.currency;
      if (code) {
        dominantCurrency = code;
        break;
      }
    }
    const openCharges: PaymentReadinessCharge[] = familyCharges
      .filter(
        (charge) =>
          charge.derivedStatus !== 'cancelled' &&
          charge.derivedStatus !== 'paid' &&
          Number(charge.remainingAmount ?? '0') > 0,
      )
      .map((charge) => {
        const rawDueDate = charge.dueDate as unknown;
        const dueDate =
          rawDueDate instanceof Date
            ? rawDueDate
            : rawDueDate
              ? new Date(rawDueDate as string)
              : null;
        const isOverdue = Boolean(charge.isOverdue);
        const isSoon =
          !isOverdue &&
          dueDate !== null &&
          dueDate.getTime() >= todayMidnight.getTime() &&
          dueDate.getTime() <= soonBoundary.getTime();
        return {
          id: charge.id,
          athleteId: charge.athleteId,
          athleteName: linkedAthleteNames.get(charge.athleteId) ?? charge.athleteId,
          itemName: charge.chargeItem?.name ?? 'Charge',
          amount: String(charge.amount),
          remainingAmount: String(charge.remainingAmount ?? charge.amount),
          dueDate: dueDate ? dueDate.toISOString() : null,
          status: isOverdue ? 'overdue' : isSoon ? 'dueSoon' : 'open',
          isOverdue,
          currency: charge.chargeItem?.currency ?? dominantCurrency,
          billingPeriodLabel: charge.billingPeriodLabel ?? null,
        } satisfies PaymentReadinessCharge;
      })
      .sort((a, b) => {
        // Overdue first, then by earliest due date, then unspecified due
        // dates last. This is the calm, expected order for a parent.
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        const aTime = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const bTime = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      });
    const visibleCharges = openCharges.slice(0, PARENT_FINANCE_CAP);
    const overdueCount = openCharges.filter((row) => row.status === 'overdue').length;
    const dueSoonCount = openCharges.filter((row) => row.status === 'dueSoon').length;
    const totalsByAthlete = new Map<
      string,
      { athleteId: string; athleteName: string; outstanding: string; overdue: string }
    >();
    for (const link of links) {
      const aggregate = financeByAthlete.get(link.athleteId);
      const outstanding = aggregate ? Number(aggregate.totalOutstanding) : 0;
      const overdue = aggregate ? Number(aggregate.totalOverdue) : 0;
      if (outstanding <= 0 && overdue <= 0) continue;
      totalsByAthlete.set(link.athleteId, {
        athleteId: link.athleteId,
        athleteName: linkedAthleteNames.get(link.athleteId) ?? link.athleteId,
        outstanding: outstanding.toFixed(2),
        overdue: overdue.toFixed(2),
      });
    }
    const familyOutstanding = Array.from(financeByAthlete.values()).reduce(
      (acc, row) => acc + Number(row.totalOutstanding ?? 0),
      0,
    );
    const familyOverdue = Array.from(financeByAthlete.values()).reduce(
      (acc, row) => acc + Number(row.totalOverdue ?? 0),
      0,
    );
    const nextDue =
      openCharges.find((row) => row.status === 'dueSoon' && !row.isOverdue) ?? null;
    const paymentReadiness = {
      currency: dominantCurrency,
      totals: {
        outstandingAmount: familyOutstanding.toFixed(2),
        overdueAmount: familyOverdue.toFixed(2),
        openCount: openCharges.length,
        overdueCount,
        dueSoonCount,
      },
      // The "tone" is read by the UI to choose the calm / attention
      // copy. We never escalate to alarming language at the API layer.
      tone: (overdueCount > 0
        ? 'attention'
        : openCharges.length > 0
          ? 'open'
          : 'clear') as 'clear' | 'open' | 'attention',
      windowDays: SOON_WINDOW_DAYS,
      nextDue: nextDue
        ? {
            chargeId: nextDue.id,
            athleteId: nextDue.athleteId,
            athleteName: nextDue.athleteName,
            itemName: nextDue.itemName,
            amount: nextDue.amount,
            remainingAmount: nextDue.remainingAmount,
            dueDate: nextDue.dueDate,
            currency: nextDue.currency,
          }
        : null,
      charges: visibleCharges,
      perAthlete: Array.from(totalsByAthlete.values()),
    };

    // Parent Portal v1.3 — Communication Continuity layer.
    //
    // We carry the small slice of "what has the club been talking to my
    // family about lately?" into the portal. There is intentionally no
    // inbox, no thread view, and no unread count theatre. We only
    // surface:
    //   - the most recent published club update the family is allowed
    //     to see (already filtered by audience above);
    //   - the most recent staff <-> family request continuity events
    //     (a club request that's still open, or one the staff just
    //     decided on) so the family understands ongoing context.
    //
    // The shape is a single, sorted, capped list of "moments" so the
    // parent UI can render it as one calm strip.
    type ContinuityMomentKind = 'club_update' | 'family_request';
    type ContinuityMoment = {
      id: string;
      kind: ContinuityMomentKind;
      occurredAt: string;
      title: string;
      summary: string | null;
      athleteName: string | null;
      status:
        | 'published'
        | 'open'
        | 'pending_family_action'
        | 'submitted'
        | 'under_review'
        | 'approved'
        | 'rejected'
        | 'completed'
        | 'closed'
        | null;
      actionId: string | null;
      audienceLabel: string | null;
    };
    const continuityWindowDays = 30;
    const continuityCutoffMs = Date.now() - continuityWindowDays * 24 * 60 * 60 * 1000;
    const continuityMoments: ContinuityMoment[] = [];
    for (const update of clubUpdates ?? []) {
      const occurredAt = update.publishedAt ? new Date(update.publishedAt) : null;
      if (!occurredAt) continue;
      if (occurredAt.getTime() < continuityCutoffMs) continue;
      continuityMoments.push({
        id: `cu-${update.id}`,
        kind: 'club_update',
        occurredAt: occurredAt.toISOString(),
        title: update.title,
        summary: update.body && update.body.length > 140
          ? `${update.body.slice(0, 137)}…`
          : update.body,
        athleteName: null,
        status: 'published',
        actionId: null,
        audienceLabel:
          update.audience && update.audience.scope !== 'all'
            ? update.audience.label ?? null
            : null,
      });
    }
    for (const action of readiness.actions) {
      // Family-action surface continuity: an "open" request is shown so
      // the family knows it is still waiting on them; a recently
      // decided one is shown so they know staff has reviewed it. We
      // intentionally hide system noise (closed/completed older than
      // the window) and never surface staff-only metadata.
      const ongoing =
        action.status === 'open' ||
        action.status === 'pending_family_action' ||
        action.status === 'submitted' ||
        action.status === 'under_review';
      const recentlyDecided =
        (action.status === 'approved' ||
          action.status === 'rejected' ||
          action.status === 'completed' ||
          action.status === 'closed') &&
        (action.reviewedAt
          ? action.reviewedAt.getTime() >= continuityCutoffMs
          : action.updatedAt.getTime() >= continuityCutoffMs);
      if (!ongoing && !recentlyDecided) continue;
      const occurredAt =
        action.reviewedAt ??
        action.submittedAt ??
        action.updatedAt ??
        action.createdAt;
      continuityMoments.push({
        id: `fa-${action.id}`,
        kind: 'family_request',
        occurredAt: (occurredAt ?? action.createdAt).toISOString(),
        title: action.title,
        summary:
          action.decisionNote ??
          action.latestResponseText ??
          action.description ??
          null,
        athleteName: action.athleteName ?? null,
        status: action.status,
        actionId: action.id,
        audienceLabel: null,
      });
    }
    continuityMoments.sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
    const continuity = {
      windowDays: continuityWindowDays,
      moments: continuityMoments.slice(0, 5),
      hasOpenFamilyRequest: continuityMoments.some(
        (moment) =>
          moment.kind === 'family_request' &&
          (moment.status === 'open' || moment.status === 'pending_family_action'),
      ),
    };

    return {
      guardian: {
        id: guardian.id,
        name: this.getGuardianName(guardian),
        email: access.email,
        phone: guardian.phone,
      },
      access: {
        status: access.status,
        activatedAt: access.activatedAt,
        lastLoginAt: access.lastLoginAt,
      },
      branding: brand,
      readiness,
      linkedAthletes,
      actions: readiness.actions,
      finance: {
        outstandingAthletes: linkedAthletes.filter((athlete) => Number(athlete.outstandingAmount) > 0).length,
        overdueAthletes: linkedAthletes.filter((athlete) => Number(athlete.overdueAmount) > 0).length,
      },
      // Parent Portal v1.3 — Payment Readiness layer (calm, non-collections).
      paymentReadiness,
      // Parent Portal v1.3 — Communication Continuity layer.
      communication: continuity,
      today: {
        training: todayTraining,
        privateLessons: todayLessons,
      },
      thisWeek: {
        items: weekItems,
      },
      clubUpdates,
      // Family Activation & Landing Pack v1 — first-landing welcome and
      // calm essentials strip. Both surfaces hide themselves on the
      // client when there is nothing meaningful to show, so the page
      // stays calm for returning families.
      landing: {
        firstLanding: firstLandingActive,
        windowDays: firstLandingWindowDays,
        essentials,
        essentialsAttentionCount: essentialsAttention,
      },
    };
  }

  async getActionDetail(tenantId: string, guardianId: string, actionId: string) {
    return this.familyActions.findOneForGuardian(tenantId, guardianId, actionId);
  }

  async submitAction(
    tenantId: string,
    guardianId: string,
    actionId: string,
    payload: {
      responseText?: string;
      phone?: string;
      email?: string;
      notes?: string;
    },
    sessionId?: string | null,
  ) {
    return this.familyActions.submitFromGuardian(tenantId, actionId, guardianId, {
      responseText: payload.responseText,
      suggestedUpdates: {
        phone: payload.phone,
        email: payload.email,
        notes: payload.notes,
      },
      portalSessionId: sessionId ?? null,
      note: 'Submitted from guardian portal',
    });
  }

  async reviewSubmission(
    tenantId: string,
    id: string,
    payload: {
      decision: 'approved' | 'rejected';
      note?: string;
    },
  ) {
    return this.familyActions.applyGuardianSubmission(tenantId, id, payload);
  }
}
