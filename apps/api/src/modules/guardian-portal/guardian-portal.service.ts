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
import { FamilyActionService } from '../family-action/family-action.service';
import { FinanceService } from '../finance/finance.service';
import { TenantService } from '../tenant/tenant.service';
import { TenantBrandingService } from '../tenant/tenant-branding.service';
import { GUARDIAN_PORTAL_SESSION_COOKIE } from './guardian-portal.constants';

type AccessStatus = GuardianPortalAccess['status'];

type SessionContext = {
  tenantId: string;
  accessId: string;
  guardianId: string;
  sessionId: string;
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
    private readonly familyActions: FamilyActionService,
    private readonly finance: FinanceService,
    private readonly tenants: TenantService,
    private readonly branding: TenantBrandingService,
    private readonly config: ConfigService,
  ) {}

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
    input: { email?: string | null },
  ): Promise<GuardianAccessSummary & { inviteLink: string }> {
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
      });
    } else {
      access.email = email;
      access.status = access.status === 'disabled' ? 'invited' : access.status;
      access.inviteTokenHash = inviteTokenHash;
      access.inviteTokenExpiresAt = inviteTokenExpiresAt;
      access.invitedAt = now;
      access.disabledAt = null;
    }

    const saved = await this.accesses.save(access);
    const hydrated = await this.findAccessById(tenantId, saved.id);
    const readiness = await this.familyActions.getGuardianReadiness(tenantId, guardianId);
    return {
      ...this.buildAccessSummary(hydrated, readiness),
      inviteLink: this.buildInviteLink(token),
    };
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
    if (!access || !access.inviteTokenExpiresAt || access.inviteTokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invite link is invalid or expired');
    }
    if (access.status === 'disabled') {
      throw new UnauthorizedException('Portal access is disabled');
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
    if (!access || !access.inviteTokenExpiresAt || access.inviteTokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invite link is invalid or expired');
    }
    if (access.status === 'disabled') {
      throw new UnauthorizedException('Portal access is disabled');
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
    await this.accesses.save(access);

    const session = await this.createSession(access);
    return {
      sessionToken: session.token,
      expiresAt: session.expiresAt,
      summary: await this.getPortalHome(access.tenantId, access.guardianId),
    };
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
      : { athletes: [], charges: [], recentPayments: [], totals: {} };
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
    const visibleTraining = upcomingTraining.filter((session) =>
      links.some(
        (link) =>
          link.athlete?.primaryGroupId === session.groupId &&
          (!session.teamId || teamMap.get(session.teamId)),
      ),
    );

    const linkedAthletes = links.map((link) => ({
      linkId: link.id,
      athleteId: link.athleteId,
      relationshipType: link.relationshipType,
      isPrimaryContact: link.isPrimaryContact,
      athleteName: link.athlete ? `${link.athlete.preferredName || link.athlete.firstName} ${link.athlete.lastName}` : link.athleteId,
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
      nextPrivateLesson: upcomingLessons
        .filter((lesson) => lesson.athleteId === link.athleteId)
        .slice(0, 1)
        .map((lesson) => ({
          id: lesson.id,
          scheduledStart: lesson.scheduledStart,
          coachName: lesson.coach
            ? `${lesson.coach.preferredName || lesson.coach.firstName} ${lesson.coach.lastName}`
            : null,
        }))[0] ?? null,
    }));

    const brand = await this.branding.getForTenant(tenantId);

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
      today: {
        training: todayTraining,
        privateLessons: todayLessons,
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
