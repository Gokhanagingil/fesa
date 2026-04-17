import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, pbkdf2Sync, randomBytes, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { Repository } from 'typeorm';
import { Coach } from '../../database/entities/coach.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { GuardianPortalAccess } from '../../database/entities/guardian-portal-access.entity';
import { StaffSession } from '../../database/entities/staff-session.entity';
import { StaffUser } from '../../database/entities/staff-user.entity';
import { Team } from '../../database/entities/team.entity';
import { TenantMembership } from '../../database/entities/tenant-membership.entity';
import {
  StaffPlatformRole,
  StaffUserStatus,
  TenantMembershipRole,
} from '../../database/enums';
import { Athlete } from '../../database/entities/athlete.entity';
import { TenantService } from '../tenant/tenant.service';
import { ActionCenterService } from '../action-center/action-center.service';
import { LoginStaffDto } from './dto/login-staff.dto';

const STAFF_SESSION_COOKIE = 'amateur_staff_session';

export type AuthTenantAccess = {
  id: string;
  name: string;
  slug: string;
  role: TenantMembershipRole | null;
  isDefault: boolean;
};

export type AuthTenantMembership = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: TenantMembershipRole;
  isDefault: boolean;
};

export type AuthSessionProfile = {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    displayName: string;
    platformRole: StaffPlatformRole;
    status: StaffUserStatus;
  };
  memberships: AuthTenantMembership[];
  accessibleTenants: AuthTenantAccess[];
  defaultTenantId: string | null;
};

export type AuthRequestContext = {
  sessionId: string;
  sessionToken: string;
  profile: AuthSessionProfile;
};

@Injectable()
export class AuthService {
  private readonly sessionTtlDays = 14;
  private readonly pbkdf2Iterations = 120_000;

  constructor(
    @InjectRepository(StaffUser)
    private readonly staffUsers: Repository<StaffUser>,
    @InjectRepository(StaffSession)
    private readonly staffSessions: Repository<StaffSession>,
    @InjectRepository(TenantMembership)
    private readonly tenantMemberships: Repository<TenantMembership>,
    @InjectRepository(Athlete)
    private readonly athletes: Repository<Athlete>,
    @InjectRepository(Guardian)
    private readonly guardians: Repository<Guardian>,
    @InjectRepository(Coach)
    private readonly coaches: Repository<Coach>,
    @InjectRepository(ClubGroup)
    private readonly groups: Repository<ClubGroup>,
    @InjectRepository(Team)
    private readonly teams: Repository<Team>,
    @InjectRepository(GuardianPortalAccess)
    private readonly guardianPortalAccesses: Repository<GuardianPortalAccess>,
    private readonly tenants: TenantService,
    private readonly actionCenter: ActionCenterService,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getDisplayName(user: Pick<StaffUser, 'firstName' | 'lastName' | 'preferredName'>): string {
    return user.preferredName?.trim() || `${user.firstName} ${user.lastName}`;
  }

  private hashToken(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const nextSalt = salt ?? randomBytes(16).toString('hex');
    const hash = pbkdf2Sync(password, nextSalt, this.pbkdf2Iterations, 64, 'sha512').toString('hex');
    return { hash, salt: nextSalt };
  }

  private verifyPassword(password: string, hash: string, salt: string): boolean {
    const next = pbkdf2Sync(password, salt, this.pbkdf2Iterations, 64, 'sha512');
    const current = Buffer.from(hash, 'hex');
    return current.length === next.length && timingSafeEqual(current, next);
  }

  private getSessionExpiry(): Date {
    const date = new Date();
    date.setDate(date.getDate() + this.sessionTtlDays);
    return date;
  }

  getCookieName(): string {
    return STAFF_SESSION_COOKIE;
  }

  getCookieOptions() {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const cookieSecureOverride = process.env.COOKIE_SECURE;
    const secure = cookieSecureOverride !== undefined
      ? cookieSecureOverride === 'true' || cookieSecureOverride === '1'
      : nodeEnv === 'production';
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure,
      path: '/',
      maxAge: this.sessionTtlDays * 24 * 60 * 60 * 1000,
    };
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

  private async getActiveUserById(id: string): Promise<StaffUser> {
    const user = await this.staffUsers.findOne({ where: { id } });
    if (!user || user.status !== StaffUserStatus.ACTIVE) {
      throw new UnauthorizedException('Staff account is not available');
    }
    return user;
  }

  private async getMembershipRows(staffUserId: string): Promise<TenantMembership[]> {
    return this.tenantMemberships.find({
      where: { staffUserId },
      relations: ['tenant'],
      order: { isDefault: 'DESC', createdAt: 'ASC' },
    });
  }

  async getProfile(staffUserId: string): Promise<AuthSessionProfile> {
    const user = await this.getActiveUserById(staffUserId);
    const memberships = await this.getMembershipRows(user.id);
    const membershipByTenant = new Map(memberships.map((membership) => [membership.tenantId, membership]));

    const accessibleTenants =
      user.platformRole === StaffPlatformRole.GLOBAL_ADMIN
        ? await this.tenants.findAll()
        : memberships.map((membership) => membership.tenant).filter(Boolean);

    const defaultTenantId =
      memberships.find((membership) => membership.isDefault)?.tenantId ??
      accessibleTenants[0]?.id ??
      null;

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        preferredName: user.preferredName,
        displayName: this.getDisplayName(user),
        platformRole: user.platformRole,
        status: user.status,
      },
      memberships: memberships.map((membership) => ({
        id: membership.id,
        tenantId: membership.tenantId,
        tenantName: membership.tenant.name,
        tenantSlug: membership.tenant.slug,
        role: membership.role,
        isDefault: membership.isDefault,
      })),
      accessibleTenants: accessibleTenants.map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        role: membershipByTenant.get(tenant.id)?.role ?? null,
        isDefault: membershipByTenant.get(tenant.id)?.isDefault ?? defaultTenantId === tenant.id,
      })),
      defaultTenantId,
    };
  }

  async listAccessibleTenants(staffUserId: string): Promise<AuthTenantAccess[]> {
    const profile = await this.getProfile(staffUserId);
    return profile.accessibleTenants;
  }

  async login(dto: LoginStaffDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.staffUsers.findOne({ where: { email } });
    if (!user || user.status !== StaffUserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!this.verifyPassword(dto.password, user.passwordHash, user.passwordSalt)) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const sessionToken = randomBytes(24).toString('hex');
    const expiresAt = this.getSessionExpiry();
    await this.staffSessions.save(
      this.staffSessions.create({
        staffUserId: user.id,
        tokenHash: this.hashToken(sessionToken),
        expiresAt,
        lastSeenAt: new Date(),
        revokedAt: null,
      }),
    );

    user.lastLoginAt = new Date();
    await this.staffUsers.save(user);

    return {
      sessionToken,
      expiresAt,
      profile: await this.getProfile(user.id),
    };
  }

  async logout(sessionToken: string): Promise<void> {
    const row = await this.staffSessions.findOne({
      where: { tokenHash: this.hashToken(sessionToken) },
    });
    if (!row || row.revokedAt) {
      return;
    }
    row.revokedAt = new Date();
    await this.staffSessions.save(row);
  }

  private async validateSessionToken(sessionToken: string): Promise<{ session: StaffSession; user: StaffUser }> {
    const session = await this.staffSessions.findOne({
      where: { tokenHash: this.hashToken(sessionToken) },
      relations: ['staffUser'],
    });

    if (!session || !session.staffUser) {
      throw new UnauthorizedException('Sign in required');
    }
    if (session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session expired');
    }
    if (session.staffUser.status !== StaffUserStatus.ACTIVE) {
      throw new UnauthorizedException('Staff account is not available');
    }

    session.lastSeenAt = new Date();
    await this.staffSessions.save(session);

    return {
      session,
      user: session.staffUser,
    };
  }

  async getRequestContext(req: Request): Promise<AuthRequestContext> {
    const sessionToken = this.readSessionToken(req);
    if (!sessionToken) {
      throw new UnauthorizedException('Sign in required');
    }

    const { session, user } = await this.validateSessionToken(sessionToken);
    return {
      sessionId: session.id,
      sessionToken,
      profile: await this.getProfile(user.id),
    };
  }

  async getPlatformOverview(staffUserId: string): Promise<{
    items: Array<{
      id: string;
      name: string;
      slug: string;
      membershipRole: TenantMembershipRole | StaffPlatformRole.GLOBAL_ADMIN | null;
      counts: {
        athletes: number;
        guardians: number;
        coaches: number;
        groups: number;
        teams: number;
        unreadActions: number;
        overdueActions: number;
        followUpActions: number;
      };
      actionCenter: {
        counts: {
          total: number;
          unread: number;
          overdue: number;
          today: number;
        };
        topCategories: Array<{
          category: 'finance' | 'family' | 'readiness' | 'private_lessons' | 'training';
          count: number;
        }>;
      };
    }>;
    total: number;
  }> {
    const profile = await this.getProfile(staffUserId);
    if (profile.user.platformRole !== StaffPlatformRole.GLOBAL_ADMIN) {
      throw new ForbiddenException('Global admin access is required');
    }

    const tenants = await this.tenants.findAll();
    const membershipByTenant = new Map<string, TenantMembershipRole>(
      profile.memberships.map((membership) => [membership.tenantId, membership.role]),
    );
    const items = await Promise.all(
      tenants.map(async (tenant) => {
        const [athletes, guardians, coaches, groups, teams, actionSummary] = await Promise.all([
          this.athletes.count({ where: { tenantId: tenant.id } }),
          this.guardians.count({ where: { tenantId: tenant.id } }),
          this.coaches.count({ where: { tenantId: tenant.id, isActive: true } }),
          this.groups.count({ where: { tenantId: tenant.id } }),
          this.teams.count({ where: { tenantId: tenant.id } }),
          this.actionCenter.listItemsSafe(tenant.id, staffUserId, { limit: 6, includeRead: true }),
        ]);

        const topCategories = Object.entries(actionSummary.counts.byCategory)
          .map(([category, count]) => ({ category, count }))
          .filter((entry) => entry.count > 0)
          .sort((left, right) => right.count - left.count)
          .slice(0, 3) as Array<{
            category: 'finance' | 'family' | 'readiness' | 'private_lessons' | 'training';
            count: number;
          }>;

        return {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          membershipRole:
            membershipByTenant.get(tenant.id) ??
            (StaffPlatformRole.GLOBAL_ADMIN as StaffPlatformRole.GLOBAL_ADMIN),
          counts: {
            athletes,
            guardians,
            coaches,
            groups,
            teams,
            unreadActions: actionSummary.counts.unread,
            overdueActions: actionSummary.counts.overdue,
            followUpActions:
              actionSummary.counts.byCategory.finance +
              actionSummary.counts.byCategory.family +
              actionSummary.counts.byCategory.readiness,
          },
          actionCenter: {
            counts: {
              total: actionSummary.counts.total,
              unread: actionSummary.counts.unread,
              overdue: actionSummary.counts.overdue,
              today: actionSummary.counts.today,
            },
            topCategories,
          },
        };
      }),
    );

    return {
      items: items.sort((left, right) => {
        if (right.counts.overdueActions !== left.counts.overdueActions) {
          return right.counts.overdueActions - left.counts.overdueActions;
        }
        if (right.counts.unreadActions !== left.counts.unreadActions) {
          return right.counts.unreadActions - left.counts.unreadActions;
        }
        return left.name.localeCompare(right.name);
      }),
      total: items.length,
    };
  }

  async getClubOverview(
    staffUserId: string,
    tenantId: string,
  ): Promise<{
    tenant: { id: string; name: string; slug: string };
    accessRole: TenantMembershipRole | StaffPlatformRole.GLOBAL_ADMIN | null;
    counts: {
      athletes: number;
      guardians: number;
      coaches: number;
      groups: number;
      teams: number;
      portalAccess: number;
    };
  }> {
    const profile = await this.getProfile(staffUserId);
    const membership = profile.memberships.find((item) => item.tenantId === tenantId);
    const isGlobalAdmin = profile.user.platformRole === StaffPlatformRole.GLOBAL_ADMIN;

    if (!isGlobalAdmin && !membership) {
      throw new ForbiddenException('This tenant is outside the current account scope');
    }

    const tenant = await this.tenants.findById(tenantId);
    if (!tenant) {
      throw new ForbiddenException('Tenant not found');
    }

    const [athletes, guardians, coaches, groups, teams, portalAccess] = await Promise.all([
      this.athletes.count({ where: { tenantId } }),
      this.guardians.count({ where: { tenantId } }),
      this.coaches.count({ where: { tenantId, isActive: true } }),
      this.groups.count({ where: { tenantId } }),
      this.teams.count({ where: { tenantId } }),
      this.guardianPortalAccesses.count({ where: { tenantId } }),
    ]);

    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      accessRole: isGlobalAdmin ? StaffPlatformRole.GLOBAL_ADMIN : membership?.role ?? null,
      counts: {
        athletes,
        guardians,
        coaches,
        groups,
        teams,
        portalAccess,
      },
    };
  }
}
