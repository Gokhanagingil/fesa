import { createHash, pbkdf2Sync } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import {
  ActionCenterItemState,
  AgeGroup,
  Athlete,
  AthleteCharge,
  AthleteGuardian,
  AthleteTeamMembership,
  ChargeItem,
  ClubGroup,
  Coach,
  FamilyActionEvent,
  FamilyActionRequest,
  Guardian,
  GuardianPortalAccess,
  Payment,
  PaymentAllocation,
  PrivateLesson,
  SportBranch,
  StaffUser,
  Team,
  Tenant,
  TenantMembership,
  TrainingSession,
  Attendance,
} from '../entities';
import {
  ActionCenterItemCategory,
  ActionCenterItemType,
  AthleteChargeStatus,
  AthleteStatus,
  AttendanceStatus,
  FamilyActionActor,
  FamilyActionRequestStatus,
  FamilyActionRequestType,
  StaffPlatformRole,
  StaffUserStatus,
  TenantMembershipRole,
  TrainingSessionStatus,
} from '../enums';
import {
  CLUB_ADMIN_ACCOUNTS,
  CLUB_IDS,
  CLUB_SLUGS,
  DEMO_TENANT_ID,
  DEMO_TENANT_NAME,
  DEMO_TENANT_SLUG,
  KADIKOY_CLUB_ADMIN_ID,
  MARMARA_CLUB_ADMIN_ID,
  MODA_CLUB_ADMIN_ID,
  PLATFORM_ADMIN_EMAIL,
  STAFF_GLOBAL_ADMIN_ID,
} from './constants';

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
}

function dt(baseDay: Date, hour: number, minute = 0): Date {
  return new Date(Date.UTC(baseDay.getUTCFullYear(), baseDay.getUTCMonth(), baseDay.getUTCDate(), hour, minute, 0));
}

function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 120_000, 64, 'sha512').toString('hex');
}

/**
 * Stable, demo-friendly shirt size for athletes that don't carry an explicit override.
 * Drives the reportable "shirt size" filter in the Reporting Foundation v1 demo.
 */
function defaultShirtSize(gender: string, birthDate: Date): string {
  const ageYears = Math.max(6, Math.min(40, new Date(2026, 0, 1).getUTCFullYear() - birthDate.getUTCFullYear()));
  if (ageYears <= 9) return 'XS';
  if (ageYears <= 12) return 'S';
  if (ageYears <= 15) return gender === 'male' ? 'L' : 'M';
  if (ageYears <= 18) return gender === 'male' ? 'XL' : 'M';
  return gender === 'male' ? 'XL' : 'L';
}

type SeedStaffUser = Pick<
  StaffUser,
  'id' | 'email' | 'firstName' | 'lastName' | 'preferredName' | 'passwordSalt' | 'passwordHash' | 'platformRole' | 'status' | 'lastLoginAt'
>;

type DemoClubSeed = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    branchCode: string;
    branchName: string;
    branchKey: 'basketball' | 'volleyball' | 'football';
  };
  staff: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    membershipRole: TenantMembershipRole;
    isDefault: boolean;
  }>;
  ageGroups: Array<{
    key: string;
    label: string;
    birthYearFrom: number;
    birthYearTo: number;
  }>;
  coaches: Array<{
    key: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    specialties: string;
    notes: string;
    isActive?: boolean;
  }>;
  groups: Array<{
    key: string;
    name: string;
    ageGroupKey: string;
    headCoachKey: string;
  }>;
  teams: Array<{
    key: string;
    name: string;
    code: string;
    groupKey: string;
    headCoachKey: string;
  }>;
  guardians: Array<{
    key: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
    portal?: {
      status: 'invited' | 'active' | 'disabled';
      password?: string;
      invitedAt: Date | null;
      activatedAt: Date | null;
      lastLoginAt: Date | null;
    };
  }>;
  athletes: Array<{
    key: string;
    firstName: string;
    lastName: string;
    birthDate: Date;
    gender: string;
    status: AthleteStatus;
    jerseyNumber: string | null;
    shirtSize?: string | null;
    primaryGroupKey: string;
    notes: string | null;
    guardians: Array<{
      guardianKey: string;
      relationshipType: string;
      isPrimary: boolean;
      notes?: string | null;
    }>;
    teamKeys?: string[];
  }>;
  trainingSessions: Array<{
    key: string;
    title: string;
    groupKey: string;
    teamKey?: string | null;
    coachKey?: string | null;
    scheduledStart: Date;
    scheduledEnd: Date;
    location: string | null;
    status: TrainingSessionStatus;
    notes: string | null;
  }>;
  attendance: Array<{
    sessionKey: string;
    athleteKey: string;
    status: AttendanceStatus;
    note: string | null;
  }>;
  chargeItems: Array<{
    key: string;
    name: string;
    category: string;
    defaultAmount: string;
    currency: string;
    isActive: boolean;
  }>;
  privateLessons: Array<{
    key: string;
    athleteKey: string;
    coachKey: string;
    focus: string | null;
    scheduledStart: Date;
    scheduledEnd: Date;
    location: string | null;
    status: TrainingSessionStatus;
    attendanceStatus: AttendanceStatus | null;
    notes: string | null;
  }>;
  athleteCharges: Array<{
    key: string;
    athleteKey: string;
    chargeItemKey: string;
    amount: string;
    dueDate: Date | null;
    status: AthleteChargeStatus;
    notes: string | null;
    privateLessonKey?: string;
    billingPeriodKey?: string | null;
    billingPeriodLabel?: string | null;
  }>;
  payments: Array<{
    key: string;
    athleteKey: string;
    amount: string;
    currency: string;
    paidAt: Date;
    method: string | null;
    reference: string | null;
    notes: string | null;
    allocations: Array<{
      chargeKey: string;
      amount: string;
    }>;
  }>;
  familyActions: Array<{
    key: string;
    athleteKey: string;
    guardianKey: string | null;
    type: FamilyActionRequestType;
    status: FamilyActionRequestStatus;
    title: string;
    description: string | null;
    dueDate: Date | null;
    payload: Record<string, unknown>;
    latestResponseText: string | null;
    decisionNote: string | null;
    submittedAt: Date | null;
    reviewedAt: Date | null;
    resolvedAt: Date | null;
    events: Array<{
      key: string;
      actor: FamilyActionActor;
      eventType: string;
      fromStatus: FamilyActionRequestStatus | null;
      toStatus: FamilyActionRequestStatus | null;
      note: string | null;
      metadata?: Record<string, unknown>;
    }>;
  }>;
  actionCenterStates: Array<{
    itemKey: string;
    snapshotToken: string;
    category: ActionCenterItemCategory;
    type: ActionCenterItemType;
    readAt?: Date | null;
    dismissedAt?: Date | null;
    completedAt?: Date | null;
    snoozedUntil?: Date | null;
    metadata?: Record<string, unknown>;
  }>;
};

function stableId(...parts: string[]): string {
  const digest = createHash('sha256').update(JSON.stringify(parts)).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Static brand presets for the seeded demo clubs. The portal renders these
 * via the controlled tenant-branding payload (logo, display name, colors,
 * welcome copy). Layout and component structure stay identical across all
 * tenants — only the marks below vary, which is the whole point of the
 * branded-shell, controlled-product-core model in Wave 17.
 */
const DEMO_BRANDING: Record<string, {
  brandDisplayName: string;
  brandTagline: string;
  brandPrimaryColor: string;
  brandAccentColor: string;
  brandWelcomeTitle: string;
  brandWelcomeMessage: string;
}> = {
  'kadikoy-genc-spor': {
    brandDisplayName: 'Kadıköy Gençlik Spor',
    brandTagline: 'Aileye yakın, sporcuya odaklı.',
    brandPrimaryColor: '#0d4a3c',
    brandAccentColor: '#1f8f6b',
    brandWelcomeTitle: 'Hoş geldiniz, Kadıköy ailesi',
    brandWelcomeMessage:
      'Bu hafta için planı, ailenizi ilgilendiren tüm güncellemeleri ve kulübümüzden gelen küçük hatırlatmaları burada bulabilirsiniz.',
  },
  'fesa-basketbol': {
    brandDisplayName: 'Fesa Basketbol',
    brandTagline: 'Basketbolla büyüyen aileler.',
    brandPrimaryColor: '#1d3557',
    brandAccentColor: '#e63946',
    brandWelcomeTitle: 'Fesa ailesi, hoş geldiniz',
    brandWelcomeMessage:
      'Sporcunuzla ilgili önemli notları, ödeme hatırlatmalarını ve antrenman programını sakince burada izleyebilirsiniz.',
  },
  'moda-voleybol-akademi': {
    brandDisplayName: 'Moda Voleybol Akademi',
    brandTagline: 'Saygılı, disiplinli, sıcak.',
    brandPrimaryColor: '#264653',
    brandAccentColor: '#2a9d8f',
    brandWelcomeTitle: 'Moda Voleybol ailesine özel',
    brandWelcomeMessage:
      'Bu alan ailenizin özel görünümüdür. Aklınıza takılan bir şey olduğunda kulüp ekibimize buradan kolayca yazabilirsiniz.',
  },
  'marmara-futbol-okulu': {
    brandDisplayName: 'Marmara Futbol Okulu',
    brandTagline: 'Sahanın dışında da yanında.',
    brandPrimaryColor: '#283618',
    brandAccentColor: '#bc6c25',
    brandWelcomeTitle: 'Marmara Futbol ailesi, hoş geldiniz',
    brandWelcomeMessage:
      'Antrenman, maç ve aile bilgilerinizi tek bir sakin ekranda topladık.',
  },
};

async function ensureTenant(tenants: Repository<Tenant>, seed: { id: string; name: string; slug: string }): Promise<Tenant> {
  const existing = await tenants.findOne({
    where: [{ id: seed.id }, { slug: seed.slug }],
  });
  const row = existing ?? tenants.create({ id: seed.id });
  row.name = seed.name;
  row.slug = seed.slug;

  const brand = DEMO_BRANDING[seed.slug];
  if (brand) {
    row.brandDisplayName = brand.brandDisplayName;
    row.brandTagline = brand.brandTagline;
    row.brandPrimaryColor = brand.brandPrimaryColor;
    row.brandAccentColor = brand.brandAccentColor;
    row.brandWelcomeTitle = brand.brandWelcomeTitle;
    row.brandWelcomeMessage = brand.brandWelcomeMessage;
    row.brandUpdatedAt = row.brandUpdatedAt ?? new Date();
  }

  return tenants.save(row);
}

async function ensureStaffUser(staffUsers: Repository<StaffUser>, seed: SeedStaffUser): Promise<StaffUser> {
  const existing = await staffUsers.findOne({
    where: [{ id: seed.id }, { email: seed.email }],
  });
  const row = existing ?? staffUsers.create({ id: seed.id });
  row.email = seed.email;
  row.firstName = seed.firstName;
  row.lastName = seed.lastName;
  row.preferredName = seed.preferredName;
  row.passwordSalt = seed.passwordSalt;
  row.passwordHash = seed.passwordHash;
  row.platformRole = seed.platformRole;
  row.status = seed.status;
  row.lastLoginAt = seed.lastLoginAt;
  return staffUsers.save(row);
}

async function ensureTenantMembership(
  memberships: Repository<TenantMembership>,
  seed: {
    tenantId: string;
    staffUserId: string;
    role: TenantMembershipRole;
    isDefault: boolean;
  },
) {
  const existing = await memberships.findOne({
    where: { tenantId: seed.tenantId, staffUserId: seed.staffUserId },
  });
  const row =
    existing ??
    memberships.create({
      id: stableId(seed.tenantId, seed.staffUserId, 'membership'),
      tenantId: seed.tenantId,
      staffUserId: seed.staffUserId,
    });
  row.role = seed.role;
  row.isDefault = seed.isDefault;
  await memberships.save(row);
}

function getDemoClubs(): DemoClubSeed[] {
  const base = new Date(Date.UTC(2026, 3, 15, 12, 0, 0));
  const monday = new Date(base);
  monday.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
  monday.setUTCHours(0, 0, 0, 0);
  const tuesday = new Date(monday);
  tuesday.setUTCDate(monday.getUTCDate() + 1);
  const wednesday = new Date(monday);
  wednesday.setUTCDate(monday.getUTCDate() + 2);
  const thursday = new Date(monday);
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  const saturday = new Date(monday);
  saturday.setUTCDate(monday.getUTCDate() + 5);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);

  return [
    {
      tenant: {
        id: DEMO_TENANT_ID,
        slug: DEMO_TENANT_SLUG,
        name: DEMO_TENANT_NAME,
        branchCode: 'BASKETBALL',
        branchName: 'Basketball',
        branchKey: 'basketball',
      },
      staff: [
        {
          id: KADIKOY_CLUB_ADMIN_ID,
          email: CLUB_ADMIN_ACCOUNTS.kadikoy.email,
          firstName: 'Cem',
          lastName: 'Akar',
          membershipRole: TenantMembershipRole.CLUB_ADMIN,
          isDefault: true,
        },
        {
          id: stableId('staff', 'kadikoy', 'operations'),
          email: 'ops@kadikoygenc.local',
          firstName: 'Selin',
          lastName: 'Tuna',
          membershipRole: TenantMembershipRole.STAFF,
          isDefault: false,
        },
      ],
      ageGroups: [
        { key: 'u12', label: 'U12', birthYearFrom: 2013, birthYearTo: 2014 },
        { key: 'u14', label: 'U14', birthYearFrom: 2011, birthYearTo: 2012 },
        { key: 'u16', label: 'U16', birthYearFrom: 2009, birthYearTo: 2010 },
      ],
      coaches: [
        {
          key: 'merve',
          firstName: 'Merve',
          lastName: 'Kılıç',
          phone: '+90 535 100 0101',
          email: 'merve.kilic@kadikoygenc.local',
          specialties: 'skills, shooting',
          notes: 'Leads basketball fundamentals and private shooting work.',
        },
        {
          key: 'burcu',
          firstName: 'Burcu',
          lastName: 'Tan',
          phone: '+90 535 100 0104',
          email: 'burcu.tan@kadikoygenc.local',
          specialties: 'transition offense, game preparation',
          notes: 'Supports weekend mini-team games and player readiness.',
        },
      ],
      groups: [
        { key: 'bb-u12', name: 'Basketball · U12 cohort', ageGroupKey: 'u12', headCoachKey: 'merve' },
        { key: 'bb-u14', name: 'Basketball · U14 cohort', ageGroupKey: 'u14', headCoachKey: 'merve' },
      ],
      teams: [
        { key: 'bb-u12-a', name: 'U12 A (Mini)', code: 'BB-U12-A', groupKey: 'bb-u12', headCoachKey: 'burcu' },
        { key: 'bb-u14-a', name: 'U14 A', code: 'BB-U14-A', groupKey: 'bb-u14', headCoachKey: 'merve' },
      ],
      guardians: [
        {
          key: 'ayse',
          firstName: 'Ayşe',
          lastName: 'Yılmaz',
          phone: '+90 532 111 2233',
          email: 'ayse.yilmaz@example.com',
          notes: 'Prefers WhatsApp follow-up for finance reminders.',
          portal: {
            status: 'active',
            password: 'Guardian123!',
            invitedAt: d(2026, 3, 15),
            activatedAt: d(2026, 3, 16),
            lastLoginAt: d(2026, 4, 12),
          },
        },
        {
          key: 'murat',
          firstName: 'Murat',
          lastName: 'Kaya',
          phone: '+90 533 444 5566',
          email: 'murat.kaya@example.com',
          notes: null,
          portal: {
            status: 'invited',
            invitedAt: d(2026, 4, 7),
            activatedAt: null,
            lastLoginAt: null,
          },
        },
        {
          key: 'elif',
          firstName: 'Elif',
          lastName: 'Demir',
          phone: '+90 534 777 8899',
          email: 'elif.demir@example.com',
          notes: 'Family is consistent with attendance but asks for payment receipts.',
        },
      ],
      athletes: [
        {
          key: 'efe',
          firstName: 'Efe',
          lastName: 'Arslan',
          birthDate: d(2013, 4, 12),
          gender: 'male',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '7',
          primaryGroupKey: 'bb-u12',
          notes: 'Group + team player; preparing for district mini-league weekend.',
          guardians: [{ guardianKey: 'ayse', relationshipType: 'mother', isPrimary: true }],
          teamKeys: ['bb-u12-a'],
        },
        {
          key: 'deniz',
          firstName: 'Deniz',
          lastName: 'Öztürk',
          birthDate: d(2013, 8, 3),
          gender: 'female',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '11',
          primaryGroupKey: 'bb-u12',
          notes: 'Group-only athlete; club is watching trial game readiness before team assignment.',
          guardians: [{ guardianKey: 'ayse', relationshipType: 'mother', isPrimary: true }],
        },
        {
          key: 'zeynep',
          firstName: 'Zeynep',
          lastName: 'Çelik',
          birthDate: d(2011, 2, 19),
          gender: 'female',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '5',
          primaryGroupKey: 'bb-u14',
          notes: 'Starting guard on the U14 A rotation.',
          guardians: [{ guardianKey: 'murat', relationshipType: 'father', isPrimary: true }],
          teamKeys: ['bb-u14-a'],
        },
        {
          key: 'cem',
          firstName: 'Cem',
          lastName: 'Şahin',
          birthDate: d(2011, 11, 7),
          gender: 'male',
          status: AthleteStatus.TRIAL,
          jerseyNumber: null,
          primaryGroupKey: 'bb-u14',
          notes: 'Trial athlete with good effort; family still completing profile details.',
          guardians: [{ guardianKey: 'murat', relationshipType: 'father', isPrimary: true }],
        },
        {
          key: 'selin',
          firstName: 'Selin',
          lastName: 'Aydın',
          birthDate: d(2012, 1, 25),
          gender: 'female',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '9',
          primaryGroupKey: 'bb-u14',
          notes: 'Cross-training basketball twice a week while balancing school exams.',
          guardians: [{ guardianKey: 'elif', relationshipType: 'mother', isPrimary: true }],
        },
      ],
      trainingSessions: [
        {
          key: 'u12-group',
          title: 'U12 — Skills & fundamentals',
          groupKey: 'bb-u12',
          coachKey: 'merve',
          scheduledStart: dt(tuesday, 15, 0),
          scheduledEnd: dt(tuesday, 16, 30),
          location: 'Caferağa Sports Hall — Court 2',
          status: TrainingSessionStatus.COMPLETED,
          notes: 'Ball handling and defensive slides',
        },
        {
          key: 'u12-team',
          title: 'U12 A — Team practice',
          groupKey: 'bb-u12',
          teamKey: 'bb-u12-a',
          coachKey: 'burcu',
          scheduledStart: dt(thursday, 16, 0),
          scheduledEnd: dt(thursday, 17, 15),
          location: 'Caferağa Sports Hall — Court 1',
          status: TrainingSessionStatus.COMPLETED,
          notes: 'Set plays and inbound series',
        },
        {
          key: 'u14-group',
          title: 'U14 — Shooting clinic',
          groupKey: 'bb-u14',
          coachKey: 'merve',
          scheduledStart: dt(wednesday, 17, 0),
          scheduledEnd: dt(wednesday, 18, 15),
          location: 'Caferağa Sports Hall — Court 2',
          status: TrainingSessionStatus.COMPLETED,
          notes: null,
        },
        {
          key: 'u12-planned',
          title: 'U12 — Weekend scrimmage (planned)',
          groupKey: 'bb-u12',
          coachKey: 'burcu',
          scheduledStart: dt(nextMonday, 10, 0),
          scheduledEnd: dt(nextMonday, 11, 30),
          location: 'Caferağa Sports Hall — Court 2',
          status: TrainingSessionStatus.PLANNED,
          notes: 'Internal scrimmage — invite parents',
        },
      ],
      attendance: [
        { sessionKey: 'u12-group', athleteKey: 'efe', status: AttendanceStatus.PRESENT, note: null },
        { sessionKey: 'u12-group', athleteKey: 'deniz', status: AttendanceStatus.LATE, note: 'Traffic on bridge' },
        { sessionKey: 'u12-team', athleteKey: 'efe', status: AttendanceStatus.PRESENT, note: null },
        { sessionKey: 'u14-group', athleteKey: 'zeynep', status: AttendanceStatus.PRESENT, note: null },
        { sessionKey: 'u14-group', athleteKey: 'cem', status: AttendanceStatus.EXCUSED, note: 'School exam' },
        { sessionKey: 'u14-group', athleteKey: 'selin', status: AttendanceStatus.PRESENT, note: null },
      ],
      chargeItems: [
        { key: 'dues', name: 'Monthly membership dues', category: 'dues', defaultAmount: '850.00', currency: 'TRY', isActive: true },
        { key: 'camp', name: 'Winter skills camp', category: 'camp', defaultAmount: '3500.00', currency: 'TRY', isActive: true },
        { key: 'sweatshirt', name: 'Club sweatshirt', category: 'merchandise', defaultAmount: '1200.00', currency: 'TRY', isActive: true },
        { key: 'tournament', name: 'Regional tournament entry', category: 'tournament', defaultAmount: '1800.00', currency: 'TRY', isActive: true },
        { key: 'private-lesson', name: 'Private lesson', category: 'private_lesson', defaultAmount: '1500.00', currency: 'TRY', isActive: true },
      ],
      privateLessons: [
        {
          key: 'efe-shooting',
          athleteKey: 'efe',
          coachKey: 'merve',
          focus: 'Shooting footwork',
          scheduledStart: dt(thursday, 13, 0),
          scheduledEnd: dt(thursday, 14, 0),
          location: 'Caferağa Sports Hall — Court 3',
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: 'Family requested extra repetition before tournament weekend.',
        },
        {
          key: 'selin-balance',
          athleteKey: 'selin',
          coachKey: 'burcu',
          focus: null,
          scheduledStart: dt(nextMonday, 14, 0),
          scheduledEnd: dt(nextMonday, 15, 0),
          location: 'Caferağa Sports Hall — Skill Lab',
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: 'Prep item intentionally incomplete to keep action-center visibility alive.',
        },
      ],
      athleteCharges: [
        { key: 'efe-dues', athleteKey: 'efe', chargeItemKey: 'dues', amount: '850.00', dueDate: d(2026, 4, 1), status: AthleteChargeStatus.PAID, notes: null },
        { key: 'efe-camp', athleteKey: 'efe', chargeItemKey: 'camp', amount: '3500.00', dueDate: d(2026, 5, 15), status: AthleteChargeStatus.PARTIALLY_PAID, notes: 'Deposit received' },
        { key: 'deniz-dues', athleteKey: 'deniz', chargeItemKey: 'dues', amount: '850.00', dueDate: d(2026, 4, 1), status: AthleteChargeStatus.PENDING, notes: null },
        { key: 'deniz-shirt', athleteKey: 'deniz', chargeItemKey: 'sweatshirt', amount: '1200.00', dueDate: d(2026, 4, 20), status: AthleteChargeStatus.PENDING, notes: null },
        { key: 'zeynep-tournament', athleteKey: 'zeynep', chargeItemKey: 'tournament', amount: '1800.00', dueDate: d(2026, 6, 1), status: AthleteChargeStatus.PENDING, notes: null },
        { key: 'selin-dues', athleteKey: 'selin', chargeItemKey: 'dues', amount: '850.00', dueDate: d(2026, 3, 1), status: AthleteChargeStatus.PAID, notes: null },
        {
          key: 'efe-private',
          athleteKey: 'efe',
          chargeItemKey: 'private-lesson',
          amount: '1500.00',
          dueDate: d(2026, 4, 25),
          status: AthleteChargeStatus.PENDING,
          notes: 'Private lesson package pending collection',
          privateLessonKey: 'efe-shooting',
        },
      ],
      payments: [
        {
          key: 'efe-dues-payment',
          athleteKey: 'efe',
          amount: '850.00',
          currency: 'TRY',
          paidAt: d(2026, 4, 2),
          method: 'transfer',
          reference: 'KGS-2026-0402',
          notes: 'April dues paid in full.',
          allocations: [{ chargeKey: 'efe-dues', amount: '850.00' }],
        },
        {
          key: 'efe-camp-deposit',
          athleteKey: 'efe',
          amount: '1500.00',
          currency: 'TRY',
          paidAt: d(2026, 4, 10),
          method: 'cash',
          reference: 'DEP-001',
          notes: 'Camp deposit at reception.',
          allocations: [{ chargeKey: 'efe-camp', amount: '1500.00' }],
        },
        {
          key: 'selin-dues-payment',
          athleteKey: 'selin',
          amount: '850.00',
          currency: 'TRY',
          paidAt: d(2026, 3, 2),
          method: 'pos',
          reference: 'POS-4492',
          notes: null,
          allocations: [{ chargeKey: 'selin-dues', amount: '850.00' }],
        },
      ],
      familyActions: [
        {
          key: 'cem-contact',
          athleteKey: 'cem',
          guardianKey: 'murat',
          type: FamilyActionRequestType.CONTACT_DETAILS_COMPLETION,
          status: FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
          title: 'Complete trial family contact details',
          description: 'We need an updated mobile number and emergency note before extending the trial.',
          dueDate: d(2026, 4, 18),
          payload: { checklist: ['phone', 'notes'] },
          latestResponseText: null,
          decisionNote: null,
          submittedAt: null,
          reviewedAt: null,
          resolvedAt: null,
          events: [
            {
              key: 'created',
              actor: FamilyActionActor.CLUB,
              eventType: 'created',
              fromStatus: null,
              toStatus: FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
              note: null,
            },
          ],
        },
        {
          key: 'deniz-profile',
          athleteKey: 'deniz',
          guardianKey: 'ayse',
          type: FamilyActionRequestType.GUARDIAN_PROFILE_UPDATE,
          status: FamilyActionRequestStatus.SUBMITTED,
          title: 'Confirm alternate pickup contact',
          description: 'Please review and confirm who can pick Deniz up after late sessions.',
          dueDate: d(2026, 4, 14),
          payload: {
            portalSubmission: {
              source: 'guardian_portal',
              guardianId: stableId(DEMO_TENANT_SLUG, 'guardian', 'ayse'),
              submittedAt: d(2026, 4, 13).toISOString(),
              responseText: 'Grandmother can help on Tuesdays.',
              suggestedUpdates: {
                phone: '+90 532 111 2233',
                notes: 'Grandmother can help on Tuesday evenings.',
              },
            },
          },
          latestResponseText: 'Grandmother can help on Tuesdays.',
          decisionNote: null,
          submittedAt: d(2026, 4, 13),
          reviewedAt: null,
          resolvedAt: null,
          events: [
            {
              key: 'created',
              actor: FamilyActionActor.CLUB,
              eventType: 'created',
              fromStatus: null,
              toStatus: FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
              note: null,
            },
            {
              key: 'submitted',
              actor: FamilyActionActor.FAMILY,
              eventType: 'guardian_submitted',
              fromStatus: FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
              toStatus: FamilyActionRequestStatus.SUBMITTED,
              note: 'Submitted from guardian portal',
              metadata: { source: 'guardian_portal' },
            },
          ],
        },
      ],
      actionCenterStates: [
        {
          itemKey: 'finance:stale-kadikoy-demo',
          snapshotToken: 'stale-kadikoy-demo',
          category: ActionCenterItemCategory.FINANCE,
          type: ActionCenterItemType.FINANCE_FOLLOW_UP,
          readAt: d(2026, 4, 10),
        },
      ],
    },
    {
      tenant: {
        id: CLUB_IDS.fesa,
        slug: CLUB_SLUGS.fesa,
        name: 'Fesa Basketbol',
        branchCode: 'BASKETBALL',
        branchName: 'Basketball',
        branchKey: 'basketball',
      },
      staff: [
        {
          id: stableId('staff', 'fesa', 'club-admin'),
          email: CLUB_ADMIN_ACCOUNTS.fesa.email,
          firstName: 'Gökhan',
          lastName: 'Agingil',
          membershipRole: TenantMembershipRole.CLUB_ADMIN,
          isDefault: true,
        },
        {
          id: stableId('staff', 'fesa', 'academy-staff'),
          email: 'staff@fesabasketbol.local',
          firstName: 'Bora',
          lastName: 'Sarı',
          membershipRole: TenantMembershipRole.STAFF,
          isDefault: false,
        },
      ],
      ageGroups: [
        { key: 'u10', label: 'U10', birthYearFrom: 2015, birthYearTo: 2016 },
        { key: 'u13', label: 'U13', birthYearFrom: 2012, birthYearTo: 2013 },
      ],
      coaches: [
        {
          key: 'eda',
          firstName: 'Eda',
          lastName: 'Karaca',
          phone: '+90 535 210 0101',
          email: 'eda.karaca@fesabasketbol.local',
          specialties: 'ball handling, mini basket',
          notes: 'Runs beginner academy flow and parent communication.',
        },
        {
          key: 'baris',
          firstName: 'Barış',
          lastName: 'Erten',
          phone: '+90 535 210 0102',
          email: 'baris.erten@fesabasketbol.local',
          specialties: 'defense, transition',
          notes: 'Leads U13 match prep and roster discipline.',
        },
      ],
      groups: [
        { key: 'academy-u10', name: 'Mini basket academy · U10', ageGroupKey: 'u10', headCoachKey: 'eda' },
        { key: 'academy-u13', name: 'Development squad · U13', ageGroupKey: 'u13', headCoachKey: 'baris' },
      ],
      teams: [
        { key: 'u13-elite', name: 'U13 Elite', code: 'FESA-U13-E', groupKey: 'academy-u13', headCoachKey: 'baris' },
      ],
      guardians: [
        {
          key: 'nazli',
          firstName: 'Nazlı',
          lastName: 'Ersoy',
          phone: '+90 531 401 1100',
          email: 'nazli.ersoy@example.com',
          notes: 'Asks for monthly payment summary.',
          portal: {
            status: 'active',
            password: 'Guardian123!',
            invitedAt: d(2026, 3, 20),
            activatedAt: d(2026, 3, 21),
            lastLoginAt: d(2026, 4, 11),
          },
        },
        {
          key: 'hakan',
          firstName: 'Hakan',
          lastName: 'Çınar',
          phone: '+90 531 401 2200',
          email: 'hakan.cinar@example.com',
          notes: null,
        },
        {
          key: 'seda',
          firstName: 'Seda',
          lastName: 'Polat',
          phone: null,
          email: 'seda.polat@example.com',
          notes: 'Contact profile still needs phone confirmation.',
          portal: {
            status: 'invited',
            invitedAt: d(2026, 4, 8),
            activatedAt: null,
            lastLoginAt: null,
          },
        },
      ],
      athletes: [
        {
          key: 'arda',
          firstName: 'Arda',
          lastName: 'Ersoy',
          birthDate: d(2015, 3, 4),
          gender: 'male',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '4',
          primaryGroupKey: 'academy-u10',
          notes: 'Needs steady fundamentals reps and family attendance follow-up.',
          guardians: [{ guardianKey: 'nazli', relationshipType: 'mother', isPrimary: true }],
        },
        {
          key: 'yigit',
          firstName: 'Yiğit',
          lastName: 'Çınar',
          birthDate: d(2012, 9, 14),
          gender: 'male',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '10',
          primaryGroupKey: 'academy-u13',
          notes: 'Primary ball-handler for the U13 Elite team.',
          guardians: [{ guardianKey: 'hakan', relationshipType: 'father', isPrimary: true }],
          teamKeys: ['u13-elite'],
        },
        {
          key: 'alya',
          firstName: 'Alya',
          lastName: 'Polat',
          birthDate: d(2013, 6, 22),
          gender: 'female',
          status: AthleteStatus.TRIAL,
          jerseyNumber: null,
          primaryGroupKey: 'academy-u13',
          notes: 'Trial athlete; family still needs to finish readiness details.',
          guardians: [{ guardianKey: 'seda', relationshipType: 'mother', isPrimary: true }],
        },
      ],
      trainingSessions: [
        {
          key: 'u10-fundamentals',
          title: 'Mini basket — fundamentals',
          groupKey: 'academy-u10',
          coachKey: 'eda',
          scheduledStart: dt(tuesday, 16, 0),
          scheduledEnd: dt(tuesday, 17, 15),
          location: 'Fesa Training Hall — Court A',
          status: TrainingSessionStatus.COMPLETED,
          notes: 'Footwork and passing rhythm',
        },
        {
          key: 'u13-team',
          title: 'U13 Elite — team prep',
          groupKey: 'academy-u13',
          teamKey: 'u13-elite',
          coachKey: 'baris',
          scheduledStart: dt(thursday, 18, 0),
          scheduledEnd: dt(thursday, 19, 30),
          location: 'Fesa Training Hall — Court B',
          status: TrainingSessionStatus.COMPLETED,
          notes: 'Weekend tournament spacing sets',
        },
        {
          key: 'u13-planned',
          title: 'U13 development — film + walkthrough',
          groupKey: 'academy-u13',
          coachKey: null,
          scheduledStart: dt(nextMonday, 17, 0),
          scheduledEnd: dt(nextMonday, 18, 15),
          location: 'Fesa Analysis Room',
          status: TrainingSessionStatus.PLANNED,
          notes: 'Coach assignment still open for staging review.',
        },
      ],
      attendance: [
        { sessionKey: 'u10-fundamentals', athleteKey: 'arda', status: AttendanceStatus.PRESENT, note: null },
        { sessionKey: 'u13-team', athleteKey: 'yigit', status: AttendanceStatus.PRESENT, note: null },
        { sessionKey: 'u13-team', athleteKey: 'alya', status: AttendanceStatus.LATE, note: 'Arrived after school shuttle' },
      ],
      chargeItems: [
        { key: 'dues', name: 'Monthly academy dues', category: 'dues', defaultAmount: '950.00', currency: 'TRY', isActive: true },
        { key: 'tournament', name: 'U13 spring tournament pack', category: 'tournament', defaultAmount: '2200.00', currency: 'TRY', isActive: true },
        { key: 'kit', name: 'Training reversible set', category: 'merchandise', defaultAmount: '1450.00', currency: 'TRY', isActive: true },
        { key: 'private-lesson', name: 'Individual skill session', category: 'private_lesson', defaultAmount: '1600.00', currency: 'TRY', isActive: true },
      ],
      privateLessons: [
        {
          key: 'yigit-ballhandling',
          athleteKey: 'yigit',
          coachKey: 'baris',
          focus: 'PnR reads vs pressure',
          scheduledStart: dt(friday, 15, 30),
          scheduledEnd: dt(friday, 16, 30),
          location: 'Fesa Skill Lab',
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: 'Extra prep before regional showcase.',
        },
      ],
      athleteCharges: [
        { key: 'arda-dues', athleteKey: 'arda', chargeItemKey: 'dues', amount: '950.00', dueDate: d(2026, 4, 5), status: AthleteChargeStatus.PENDING, notes: 'Family requested invoice resend' },
        { key: 'yigit-dues', athleteKey: 'yigit', chargeItemKey: 'dues', amount: '950.00', dueDate: d(2026, 4, 5), status: AthleteChargeStatus.PAID, notes: null },
        { key: 'yigit-tournament', athleteKey: 'yigit', chargeItemKey: 'tournament', amount: '2200.00', dueDate: d(2026, 4, 28), status: AthleteChargeStatus.PARTIALLY_PAID, notes: 'Deposit collected at desk' },
        { key: 'alya-kit', athleteKey: 'alya', chargeItemKey: 'kit', amount: '1450.00', dueDate: d(2026, 4, 22), status: AthleteChargeStatus.PENDING, notes: 'Only if trial converts to active' },
        {
          key: 'yigit-private',
          athleteKey: 'yigit',
          chargeItemKey: 'private-lesson',
          amount: '1600.00',
          dueDate: d(2026, 4, 18),
          status: AthleteChargeStatus.PENDING,
          notes: 'Linked to extra skill lesson.',
          privateLessonKey: 'yigit-ballhandling',
        },
      ],
      payments: [
        {
          key: 'yigit-dues-payment',
          athleteKey: 'yigit',
          amount: '950.00',
          currency: 'TRY',
          paidAt: d(2026, 4, 4),
          method: 'transfer',
          reference: 'FESA-APR',
          notes: null,
          allocations: [{ chargeKey: 'yigit-dues', amount: '950.00' }],
        },
        {
          key: 'yigit-tournament-deposit',
          athleteKey: 'yigit',
          amount: '1200.00',
          currency: 'TRY',
          paidAt: d(2026, 4, 9),
          method: 'cash',
          reference: 'TOUR-DEP',
          notes: null,
          allocations: [{ chargeKey: 'yigit-tournament', amount: '1200.00' }],
        },
      ],
      familyActions: [
        {
          key: 'alya-enrollment',
          athleteKey: 'alya',
          guardianKey: 'seda',
          type: FamilyActionRequestType.ENROLLMENT_READINESS,
          status: FamilyActionRequestStatus.PENDING_FAMILY_ACTION,
          title: 'Complete trial enrollment checklist',
          description: 'Please confirm phone details and pickup authorization before the next U13 session.',
          dueDate: d(2026, 4, 19),
          payload: { checklist: ['guardian_phone', 'pickup_authorization'] },
          latestResponseText: null,
          decisionNote: null,
          submittedAt: null,
          reviewedAt: null,
          resolvedAt: null,
          events: [
            { key: 'created', actor: FamilyActionActor.CLUB, eventType: 'created', fromStatus: null, toStatus: FamilyActionRequestStatus.PENDING_FAMILY_ACTION, note: null },
          ],
        },
      ],
      actionCenterStates: [],
    },
    {
      tenant: {
        id: CLUB_IDS.moda,
        slug: CLUB_SLUGS.moda,
        name: 'Moda Voleybol Akademi',
        branchCode: 'VOLLEYBALL',
        branchName: 'Volleyball',
        branchKey: 'volleyball',
      },
      staff: [
        {
          id: MODA_CLUB_ADMIN_ID,
          email: CLUB_ADMIN_ACCOUNTS.moda.email,
          firstName: 'Melis',
          lastName: 'Çevik',
          membershipRole: TenantMembershipRole.CLUB_ADMIN,
          isDefault: true,
        },
        {
          id: stableId('staff', 'moda', 'academy-coordinator'),
          email: 'staff@modavoleybol.local',
          firstName: 'Can',
          lastName: 'Çakır',
          membershipRole: TenantMembershipRole.STAFF,
          isDefault: false,
        },
      ],
      ageGroups: [
        { key: 'u13', label: 'U13', birthYearFrom: 2012, birthYearTo: 2013 },
        { key: 'u15', label: 'U15', birthYearFrom: 2010, birthYearTo: 2011 },
      ],
      coaches: [
        {
          key: 'kerem',
          firstName: 'Kerem',
          lastName: 'Yalçın',
          phone: '+90 535 310 0101',
          email: 'kerem.yalcin@modavoleybol.local',
          specialties: 'reception, defense',
          notes: 'Leads serve-receive development.',
        },
        {
          key: 'irem',
          firstName: 'İrem',
          lastName: 'Köse',
          phone: '+90 535 310 0102',
          email: 'irem.kose@modavoleybol.local',
          specialties: 'setting, tempo offense',
          notes: 'Runs match roster prep and setter clinics.',
        },
      ],
      groups: [
        { key: 'u13-dev', name: 'Volley academy · U13', ageGroupKey: 'u13', headCoachKey: 'kerem' },
        { key: 'u15-performance', name: 'Performance squad · U15', ageGroupKey: 'u15', headCoachKey: 'irem' },
      ],
      teams: [
        { key: 'u15-a', name: 'U15 Match Squad', code: 'MODA-U15-A', groupKey: 'u15-performance', headCoachKey: 'irem' },
      ],
      guardians: [
        {
          key: 'pinar',
          firstName: 'Pınar',
          lastName: 'Aksoy',
          phone: '+90 532 601 1100',
          email: 'pinar.aksoy@example.com',
          notes: null,
          portal: {
            status: 'active',
            password: 'Guardian123!',
            invitedAt: d(2026, 3, 18),
            activatedAt: d(2026, 3, 18),
            lastLoginAt: d(2026, 4, 14),
          },
        },
        {
          key: 'tolga',
          firstName: 'Tolga',
          lastName: 'Duman',
          phone: '+90 532 601 2200',
          email: 'tolga.duman@example.com',
          notes: 'Often coordinates transport with another family.',
        },
      ],
      athletes: [
        {
          key: 'derin',
          firstName: 'Derin',
          lastName: 'Aksoy',
          birthDate: d(2012, 5, 18),
          gender: 'female',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '2',
          primaryGroupKey: 'u13-dev',
          notes: 'Reliable receiver; candidate for U15 shadow sessions next quarter.',
          guardians: [{ guardianKey: 'pinar', relationshipType: 'mother', isPrimary: true }],
        },
        {
          key: 'ece',
          firstName: 'Ece',
          lastName: 'Duman',
          birthDate: d(2010, 10, 7),
          gender: 'female',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '8',
          primaryGroupKey: 'u15-performance',
          notes: 'Starting outside hitter in match squad.',
          guardians: [{ guardianKey: 'tolga', relationshipType: 'father', isPrimary: true }],
          teamKeys: ['u15-a'],
        },
        {
          key: 'alya-v',
          firstName: 'Alya',
          lastName: 'Toprak',
          birthDate: d(2011, 12, 4),
          gender: 'female',
          status: AthleteStatus.PAUSED,
          jerseyNumber: null,
          primaryGroupKey: 'u15-performance',
          notes: 'Paused for ankle rehab but still visible for readiness and finance follow-up.',
          guardians: [{ guardianKey: 'pinar', relationshipType: 'guardian', isPrimary: false }],
        },
      ],
      trainingSessions: [
        {
          key: 'u13-reception',
          title: 'U13 — Reception block',
          groupKey: 'u13-dev',
          coachKey: 'kerem',
          scheduledStart: dt(monday, 18, 0),
          scheduledEnd: dt(monday, 19, 30),
          location: 'Moda Volleyball Annex',
          status: TrainingSessionStatus.COMPLETED,
          notes: 'Serve receive patterns',
        },
        {
          key: 'u15-match',
          title: 'U15 — Match system rehearsal',
          groupKey: 'u15-performance',
          teamKey: 'u15-a',
          coachKey: 'irem',
          scheduledStart: dt(wednesday, 18, 30),
          scheduledEnd: dt(wednesday, 20, 0),
          location: 'Moda Volleyball Annex',
          status: TrainingSessionStatus.COMPLETED,
          notes: 'Side-out pressure reps',
        },
        {
          key: 'u13-planned',
          title: 'U13 — Parent open session',
          groupKey: 'u13-dev',
          coachKey: 'kerem',
          scheduledStart: dt(nextMonday, 17, 30),
          scheduledEnd: dt(nextMonday, 18, 45),
          location: null,
          status: TrainingSessionStatus.PLANNED,
          notes: 'Location still to be confirmed with school hall.',
        },
      ],
      attendance: [
        { sessionKey: 'u13-reception', athleteKey: 'derin', status: AttendanceStatus.PRESENT, note: null },
        { sessionKey: 'u15-match', athleteKey: 'ece', status: AttendanceStatus.PRESENT, note: null },
        { sessionKey: 'u15-match', athleteKey: 'alya-v', status: AttendanceStatus.ABSENT, note: 'Rehab protocol' },
      ],
      chargeItems: [
        { key: 'dues', name: 'Monthly academy dues', category: 'dues', defaultAmount: '900.00', currency: 'TRY', isActive: true },
        { key: 'camp', name: 'Pre-season camp', category: 'camp', defaultAmount: '2800.00', currency: 'TRY', isActive: true },
        { key: 'jersey', name: 'Match jersey set', category: 'merchandise', defaultAmount: '1350.00', currency: 'TRY', isActive: true },
      ],
      privateLessons: [],
      athleteCharges: [
        { key: 'derin-dues', athleteKey: 'derin', chargeItemKey: 'dues', amount: '900.00', dueDate: d(2026, 4, 4), status: AthleteChargeStatus.PAID, notes: null },
        { key: 'ece-camp', athleteKey: 'ece', chargeItemKey: 'camp', amount: '2800.00', dueDate: d(2026, 5, 1), status: AthleteChargeStatus.PENDING, notes: 'Family requested installment plan' },
        { key: 'ece-jersey', athleteKey: 'ece', chargeItemKey: 'jersey', amount: '1350.00', dueDate: d(2026, 4, 24), status: AthleteChargeStatus.PENDING, notes: null },
      ],
      payments: [
        {
          key: 'derin-dues-payment',
          athleteKey: 'derin',
          amount: '900.00',
          currency: 'TRY',
          paidAt: d(2026, 4, 3),
          method: 'pos',
          reference: 'MVA-APR',
          notes: null,
          allocations: [{ chargeKey: 'derin-dues', amount: '900.00' }],
        },
      ],
      familyActions: [
        {
          key: 'ece-consent',
          athleteKey: 'ece',
          guardianKey: 'tolga',
          type: FamilyActionRequestType.CONSENT_ACKNOWLEDGEMENT,
          status: FamilyActionRequestStatus.UNDER_REVIEW,
          title: 'Travel consent confirmation',
          description: 'Consent text was submitted from the portal and awaits staff review before the away match.',
          dueDate: d(2026, 4, 16),
          payload: {
            portalSubmission: {
              source: 'guardian_portal',
              guardianId: stableId(CLUB_SLUGS.moda, 'guardian', 'tolga'),
              submittedAt: d(2026, 4, 14).toISOString(),
              responseText: 'Approved for away match travel.',
              suggestedUpdates: {},
            },
          },
          latestResponseText: 'Approved for away match travel.',
          decisionNote: null,
          submittedAt: d(2026, 4, 14),
          reviewedAt: d(2026, 4, 15),
          resolvedAt: null,
          events: [
            { key: 'created', actor: FamilyActionActor.CLUB, eventType: 'created', fromStatus: null, toStatus: FamilyActionRequestStatus.PENDING_FAMILY_ACTION, note: null },
            { key: 'submitted', actor: FamilyActionActor.FAMILY, eventType: 'guardian_submitted', fromStatus: FamilyActionRequestStatus.PENDING_FAMILY_ACTION, toStatus: FamilyActionRequestStatus.SUBMITTED, note: 'Submitted from guardian portal' },
            { key: 'review', actor: FamilyActionActor.CLUB, eventType: 'status_changed', fromStatus: FamilyActionRequestStatus.SUBMITTED, toStatus: FamilyActionRequestStatus.UNDER_REVIEW, note: 'Coach requested a final document check' },
          ],
        },
      ],
      actionCenterStates: [],
    },
    {
      tenant: {
        id: CLUB_IDS.marmara,
        slug: CLUB_SLUGS.marmara,
        name: 'Marmara Futbol Okulu',
        branchCode: 'FOOTBALL',
        branchName: 'Football',
        branchKey: 'football',
      },
      staff: [
        {
          id: MARMARA_CLUB_ADMIN_ID,
          email: CLUB_ADMIN_ACCOUNTS.marmara.email,
          firstName: 'Onur',
          lastName: 'Demirtaş',
          membershipRole: TenantMembershipRole.CLUB_ADMIN,
          isDefault: true,
        },
        {
          id: stableId('staff', 'marmara', 'operations'),
          email: 'staff@marmarafutbol.local',
          firstName: 'Emre',
          lastName: 'Taşkın',
          membershipRole: TenantMembershipRole.STAFF,
          isDefault: false,
        },
      ],
      ageGroups: [
        { key: 'u11', label: 'U11', birthYearFrom: 2014, birthYearTo: 2015 },
        { key: 'u16', label: 'U16', birthYearFrom: 2009, birthYearTo: 2010 },
      ],
      coaches: [
        {
          key: 'onur',
          firstName: 'Onur',
          lastName: 'Ateş',
          phone: '+90 535 410 0101',
          email: 'onur.ates@marmarafutbol.local',
          specialties: 'small-sided games, transitions',
          notes: 'Academy lead for U16 progression.',
        },
        {
          key: 'mehmet',
          firstName: 'Mehmet',
          lastName: 'Duru',
          phone: '+90 535 410 0102',
          email: 'mehmet.duru@marmarafutbol.local',
          specialties: 'ball mastery, entry-level groups',
          notes: 'Works with younger academy players and parent readiness.',
        },
      ],
      groups: [
        { key: 'u11-foundation', name: 'Football academy · U11', ageGroupKey: 'u11', headCoachKey: 'mehmet' },
        { key: 'u16-performance', name: 'Performance squad · U16', ageGroupKey: 'u16', headCoachKey: 'onur' },
      ],
      teams: [
        { key: 'u16-red', name: 'U16 Red Squad', code: 'MFO-U16-R', groupKey: 'u16-performance', headCoachKey: 'onur' },
      ],
      guardians: [
        {
          key: 'fatma',
          firstName: 'Fatma',
          lastName: 'Yıldız',
          phone: '+90 533 701 1100',
          email: 'fatma.yildiz@example.com',
          notes: null,
        },
        {
          key: 'levent',
          firstName: 'Levent',
          lastName: 'Koçak',
          phone: '+90 533 701 2200',
          email: 'levent.kocak@example.com',
          notes: 'Wants attendance recap after every weekend match block.',
          portal: {
            status: 'active',
            password: 'Guardian123!',
            invitedAt: d(2026, 3, 25),
            activatedAt: d(2026, 3, 26),
            lastLoginAt: d(2026, 4, 13),
          },
        },
      ],
      athletes: [
        {
          key: 'kerem-f',
          firstName: 'Kerem',
          lastName: 'Yıldız',
          birthDate: d(2009, 9, 30),
          gender: 'male',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '10',
          primaryGroupKey: 'u16-performance',
          notes: 'Captain profile; visible finance and session history should feel complete.',
          guardians: [{ guardianKey: 'fatma', relationshipType: 'mother', isPrimary: true }],
          teamKeys: ['u16-red'],
        },
        {
          key: 'burak-f',
          firstName: 'Burak',
          lastName: 'Erdoğan',
          birthDate: d(2010, 3, 8),
          gender: 'male',
          status: AthleteStatus.PAUSED,
          jerseyNumber: null,
          primaryGroupKey: 'u16-performance',
          notes: 'Paused for travel; remains in follow-up views.',
          guardians: [{ guardianKey: 'levent', relationshipType: 'father', isPrimary: true }],
        },
        {
          key: 'can',
          firstName: 'Can',
          lastName: 'Kara',
          birthDate: d(2014, 8, 2),
          gender: 'male',
          status: AthleteStatus.ACTIVE,
          jerseyNumber: '6',
          primaryGroupKey: 'u11-foundation',
          notes: 'Younger academy athlete with strong attendance record.',
          guardians: [{ guardianKey: 'levent', relationshipType: 'guardian', isPrimary: false }],
        },
      ],
      trainingSessions: [
        {
          key: 'u16-games',
          title: 'U16 — Small-sided games',
          groupKey: 'u16-performance',
          coachKey: 'onur',
          scheduledStart: dt(wednesday, 18, 30),
          scheduledEnd: dt(wednesday, 20, 0),
          location: 'Marmara Grass Pitch',
          status: TrainingSessionStatus.COMPLETED,
          notes: 'Pressing triggers and rest defense',
        },
        {
          key: 'u11-foundation',
          title: 'U11 — Coordination & finishing',
          groupKey: 'u11-foundation',
          coachKey: 'mehmet',
          scheduledStart: dt(thursday, 17, 0),
          scheduledEnd: dt(thursday, 18, 15),
          location: 'Marmara Side Pitch',
          status: TrainingSessionStatus.COMPLETED,
          notes: 'Ball mastery and finishing stations',
        },
        {
          key: 'u16-planned',
          title: 'U16 — Weekend match prep',
          groupKey: 'u16-performance',
          teamKey: 'u16-red',
          coachKey: 'onur',
          scheduledStart: dt(nextMonday, 19, 0),
          scheduledEnd: dt(nextMonday, 20, 15),
          location: 'Marmara Grass Pitch',
          status: TrainingSessionStatus.PLANNED,
          notes: 'Final set-piece reminders before scrimmage.',
        },
      ],
      attendance: [
        { sessionKey: 'u16-games', athleteKey: 'kerem-f', status: AttendanceStatus.PRESENT, note: null },
        { sessionKey: 'u16-games', athleteKey: 'burak-f', status: AttendanceStatus.ABSENT, note: 'Inactive roster' },
        { sessionKey: 'u11-foundation', athleteKey: 'can', status: AttendanceStatus.PRESENT, note: null },
      ],
      chargeItems: [
        { key: 'dues', name: 'Monthly academy dues', category: 'dues', defaultAmount: '800.00', currency: 'TRY', isActive: true },
        { key: 'camp', name: 'Spring camp', category: 'camp', defaultAmount: '3200.00', currency: 'TRY', isActive: true },
        { key: 'kit', name: 'Training kit', category: 'merchandise', defaultAmount: '1100.00', currency: 'TRY', isActive: true },
      ],
      privateLessons: [],
      athleteCharges: [
        { key: 'kerem-dues', athleteKey: 'kerem-f', chargeItemKey: 'dues', amount: '800.00', dueDate: d(2026, 4, 3), status: AthleteChargeStatus.PAID, notes: null },
        { key: 'burak-dues', athleteKey: 'burak-f', chargeItemKey: 'dues', amount: '800.00', dueDate: d(2026, 2, 1), status: AthleteChargeStatus.PARTIALLY_PAID, notes: 'Paused membership' },
        { key: 'can-kit', athleteKey: 'can', chargeItemKey: 'kit', amount: '1100.00', dueDate: d(2026, 4, 21), status: AthleteChargeStatus.PENDING, notes: null },
        { key: 'kerem-camp', athleteKey: 'kerem-f', chargeItemKey: 'camp', amount: '3200.00', dueDate: d(2026, 5, 10), status: AthleteChargeStatus.CANCELLED, notes: 'Family moved to summer camp cohort' },
      ],
      payments: [
        {
          key: 'kerem-dues-payment',
          athleteKey: 'kerem-f',
          amount: '800.00',
          currency: 'TRY',
          paidAt: d(2026, 4, 2),
          method: 'transfer',
          reference: 'MFO-APR',
          notes: null,
          allocations: [{ chargeKey: 'kerem-dues', amount: '800.00' }],
        },
        {
          key: 'burak-partial',
          athleteKey: 'burak-f',
          amount: '300.00',
          currency: 'TRY',
          paidAt: d(2026, 2, 5),
          method: 'cash',
          reference: 'PART-300',
          notes: 'Family paid before travel pause.',
          allocations: [{ chargeKey: 'burak-dues', amount: '300.00' }],
        },
      ],
      familyActions: [
        {
          key: 'burak-profile',
          athleteKey: 'burak-f',
          guardianKey: 'levent',
          type: FamilyActionRequestType.PROFILE_CORRECTION,
          status: FamilyActionRequestStatus.COMPLETED,
          title: 'Update pause return date',
          description: 'Family confirmed likely return date after travel.',
          dueDate: d(2026, 3, 5),
          payload: { field: 'return_date' },
          latestResponseText: 'We expect to return in May.',
          decisionNote: 'Applied to notes.',
          submittedAt: d(2026, 3, 4),
          reviewedAt: d(2026, 3, 5),
          resolvedAt: d(2026, 3, 5),
          events: [
            { key: 'created', actor: FamilyActionActor.CLUB, eventType: 'created', fromStatus: null, toStatus: FamilyActionRequestStatus.PENDING_FAMILY_ACTION, note: null },
            { key: 'submitted', actor: FamilyActionActor.FAMILY, eventType: 'guardian_submitted', fromStatus: FamilyActionRequestStatus.PENDING_FAMILY_ACTION, toStatus: FamilyActionRequestStatus.SUBMITTED, note: 'Submitted from guardian portal' },
            { key: 'approved', actor: FamilyActionActor.CLUB, eventType: 'review_decision', fromStatus: FamilyActionRequestStatus.SUBMITTED, toStatus: FamilyActionRequestStatus.COMPLETED, note: 'Applied to athlete notes' },
          ],
        },
      ],
      actionCenterStates: [],
    },
  ];
}

async function upsertReferenceRows(
  club: DemoClubSeed,
  repos: {
    branches: Repository<SportBranch>;
    ageGroups: Repository<AgeGroup>;
    coaches: Repository<Coach>;
    groups: Repository<ClubGroup>;
    teams: Repository<Team>;
  },
) {
  const branchId = stableId(club.tenant.slug, 'branch', club.tenant.branchKey);
  const branch =
    (await repos.branches.findOne({ where: { id: branchId } })) ??
    repos.branches.create({ id: branchId, tenantId: club.tenant.id });
  branch.code = club.tenant.branchCode;
  branch.name = club.tenant.branchName;
  await repos.branches.save(branch);

  const ageGroupIds = new Map<string, string>();
  for (const item of club.ageGroups) {
    const id = stableId(club.tenant.slug, 'age', item.key);
    ageGroupIds.set(item.key, id);
    const row =
      (await repos.ageGroups.findOne({ where: { id } })) ??
      repos.ageGroups.create({ id, tenantId: club.tenant.id });
    row.label = item.label;
    row.birthYearFrom = item.birthYearFrom;
    row.birthYearTo = item.birthYearTo;
    await repos.ageGroups.save(row);
  }

  const coachIds = new Map<string, string>();
  for (const item of club.coaches) {
    const id = stableId(club.tenant.slug, 'coach', item.key);
    coachIds.set(item.key, id);
    const row =
      (await repos.coaches.findOne({ where: { id } })) ??
      repos.coaches.create({ id, tenantId: club.tenant.id, sportBranchId: branchId });
    row.firstName = item.firstName;
    row.lastName = item.lastName;
    row.preferredName = null;
    row.phone = item.phone;
    row.email = item.email;
    row.specialties = item.specialties;
    row.notes = item.notes;
    row.isActive = item.isActive ?? true;
    await repos.coaches.save(row);
  }

  const groupIds = new Map<string, string>();
  for (const item of club.groups) {
    const id = stableId(club.tenant.slug, 'group', item.key);
    groupIds.set(item.key, id);
    const row =
      (await repos.groups.findOne({ where: { id } })) ??
      repos.groups.create({ id, tenantId: club.tenant.id, sportBranchId: branchId });
    row.name = item.name;
    row.ageGroupId = ageGroupIds.get(item.ageGroupKey) ?? null;
    row.headCoachId = coachIds.get(item.headCoachKey) ?? null;
    await repos.groups.save(row);
  }

  for (const item of club.teams) {
    const id = stableId(club.tenant.slug, 'team', item.key);
    const row =
      (await repos.teams.findOne({ where: { id } })) ??
      repos.teams.create({ id, tenantId: club.tenant.id, sportBranchId: branchId });
    row.name = item.name;
    row.code = item.code;
    row.groupId = groupIds.get(item.groupKey) ?? null;
    row.headCoachId = coachIds.get(item.headCoachKey) ?? null;
    await repos.teams.save(row);
  }

  return { branchId, ageGroupIds, coachIds, groupIds };
}

export async function runDemoSeed(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const tenants = manager.getRepository(Tenant);
    const branches = manager.getRepository(SportBranch);
    const ageGroups = manager.getRepository(AgeGroup);
    const groups = manager.getRepository(ClubGroup);
    const teams = manager.getRepository(Team);
    const coaches = manager.getRepository(Coach);
    const guardians = manager.getRepository(Guardian);
    const athletes = manager.getRepository(Athlete);
    const athleteGuardians = manager.getRepository(AthleteGuardian);
    const memberships = manager.getRepository(AthleteTeamMembership);
    const sessions = manager.getRepository(TrainingSession);
    const attendances = manager.getRepository(Attendance);
    const privateLessons = manager.getRepository(PrivateLesson);
    const chargeItems = manager.getRepository(ChargeItem);
    const athleteCharges = manager.getRepository(AthleteCharge);
    const payments = manager.getRepository(Payment);
    const paymentAllocations = manager.getRepository(PaymentAllocation);
    const familyActionRequests = manager.getRepository(FamilyActionRequest);
    const familyActionEvents = manager.getRepository(FamilyActionEvent);
    const guardianPortalAccesses = manager.getRepository(GuardianPortalAccess);
    const staffUsers = manager.getRepository(StaffUser);
    const tenantMemberships = manager.getRepository(TenantMembership);
    const actionCenterStates = manager.getRepository(ActionCenterItemState);

    const globalAdminSalt = 'wave8-global-admin-salt';
    await ensureStaffUser(staffUsers, {
      id: STAFF_GLOBAL_ADMIN_ID,
      email: PLATFORM_ADMIN_EMAIL,
      firstName: 'Platform',
      lastName: 'Admin',
      preferredName: null,
      passwordSalt: globalAdminSalt,
      passwordHash: hashPassword('Admin123!', globalAdminSalt),
      platformRole: StaffPlatformRole.GLOBAL_ADMIN,
      status: StaffUserStatus.ACTIVE,
      lastLoginAt: null,
    });

    const clubs = getDemoClubs();
    for (const club of clubs) {
      await ensureTenant(tenants, club.tenant);

      for (const staff of club.staff) {
        const salt = `${club.tenant.slug}-${staff.email}-salt`;
        const user = await ensureStaffUser(staffUsers, {
          id: staff.id,
          email: staff.email,
          firstName: staff.firstName,
          lastName: staff.lastName,
          preferredName: null,
          passwordSalt: salt,
          passwordHash: hashPassword('Admin123!', salt),
          platformRole: StaffPlatformRole.STANDARD,
          status: StaffUserStatus.ACTIVE,
          lastLoginAt: null,
        });
        await ensureTenantMembership(tenantMemberships, {
          tenantId: club.tenant.id,
          staffUserId: user.id,
          role: staff.membershipRole,
          isDefault: staff.isDefault,
        });
      }

      const { branchId, coachIds, groupIds } = await upsertReferenceRows(club, {
        branches,
        ageGroups,
        coaches,
        groups,
        teams,
      });

      const teamIds = new Map<string, string>();
      for (const item of club.teams) {
        teamIds.set(item.key, stableId(club.tenant.slug, 'team', item.key));
      }

      const guardianIds = new Map<string, string>();
      for (const item of club.guardians) {
        const id = stableId(club.tenant.slug, 'guardian', item.key);
        guardianIds.set(item.key, id);
        const row =
          (await guardians.findOne({ where: { id } })) ??
          guardians.create({ id, tenantId: club.tenant.id });
        row.firstName = item.firstName;
        row.lastName = item.lastName;
        row.phone = item.phone;
        row.email = item.email;
        row.notes = item.notes;
        await guardians.save(row);

        if (item.portal) {
          const accessId = stableId(club.tenant.slug, 'portal', item.key);
          const access =
            (await guardianPortalAccesses.findOne({ where: { id: accessId } })) ??
            guardianPortalAccesses.create({
              id: accessId,
              tenantId: club.tenant.id,
              guardianId: id,
            });
          access.email = item.email ?? `${item.key}@${club.tenant.slug}.local`;
          access.status = item.portal.status;
          if (item.portal.password) {
            const salt = `${club.tenant.slug}-${item.key}-guardian-portal-salt`;
            access.passwordSalt = salt;
            access.passwordHash = hashPassword(item.portal.password, salt);
          }
          access.inviteTokenHash = null;
          access.inviteTokenExpiresAt = null;
          access.invitedAt = item.portal.invitedAt;
          access.activatedAt = item.portal.activatedAt;
          access.lastLoginAt = item.portal.lastLoginAt;
          access.disabledAt = item.portal.status === 'disabled' ? d(2026, 4, 1) : null;
          await guardianPortalAccesses.save(access);
        }
      }

      const athleteIds = new Map<string, string>();
      for (const item of club.athletes) {
        const id = stableId(club.tenant.slug, 'athlete', item.key);
        athleteIds.set(item.key, id);
        const row =
          (await athletes.findOne({ where: { id } })) ??
          athletes.create({ id, tenantId: club.tenant.id, sportBranchId: branchId });
        row.firstName = item.firstName;
        row.lastName = item.lastName;
        row.preferredName = null;
        row.birthDate = item.birthDate;
        row.gender = item.gender;
        row.status = item.status;
        row.jerseyNumber = item.jerseyNumber;
        row.shirtSize = item.shirtSize ?? defaultShirtSize(item.gender, item.birthDate);
        row.primaryGroupId = groupIds.get(item.primaryGroupKey) ?? null;
        row.notes = item.notes;
        await athletes.save(row);

        for (const link of item.guardians) {
          const relationId = stableId(club.tenant.slug, 'athlete-guardian', item.key, link.guardianKey);
          const relation =
            (await athleteGuardians.findOne({ where: { id: relationId } })) ??
            athleteGuardians.create({
              id: relationId,
              tenantId: club.tenant.id,
              athleteId: id,
              guardianId: guardianIds.get(link.guardianKey)!,
            });
          relation.relationshipType = link.relationshipType;
          relation.isPrimaryContact = link.isPrimary;
          relation.notes = link.notes ?? null;
          await athleteGuardians.save(relation);
        }

        for (const teamKey of item.teamKeys ?? []) {
          const membershipId = stableId(club.tenant.slug, 'athlete-team', item.key, teamKey);
          const membership =
            (await memberships.findOne({ where: { id: membershipId } })) ??
            memberships.create({
              id: membershipId,
              tenantId: club.tenant.id,
              athleteId: id,
              teamId: teamIds.get(teamKey)!,
            });
          membership.startedAt = new Date('2025-09-01T00:00:00.000Z');
          membership.endedAt = null;
          await memberships.save(membership);
        }
      }

      const sessionIds = new Map<string, string>();
      for (const item of club.trainingSessions) {
        const id = stableId(club.tenant.slug, 'session', item.key);
        sessionIds.set(item.key, id);
        const row =
          (await sessions.findOne({ where: { id } })) ??
          sessions.create({
            id,
            tenantId: club.tenant.id,
            sportBranchId: branchId,
            groupId: groupIds.get(item.groupKey)!,
          });
        row.title = item.title;
        row.teamId = item.teamKey ? teamIds.get(item.teamKey) ?? null : null;
        row.coachId = item.coachKey ? coachIds.get(item.coachKey) ?? null : null;
        row.scheduledStart = item.scheduledStart;
        row.scheduledEnd = item.scheduledEnd;
        row.location = item.location;
        row.status = item.status;
        row.notes = item.notes;
        await sessions.save(row);
      }

      for (const item of club.attendance) {
        const id = stableId(club.tenant.slug, 'attendance', item.sessionKey, item.athleteKey);
        const row =
          (await attendances.findOne({ where: { id } })) ??
          attendances.create({
            id,
            tenantId: club.tenant.id,
            trainingSessionId: sessionIds.get(item.sessionKey)!,
            athleteId: athleteIds.get(item.athleteKey)!,
          });
        row.status = item.status;
        row.note = item.note;
        row.recordedAt = new Date();
        await attendances.save(row);
      }

      const chargeItemIds = new Map<string, string>();
      for (const item of club.chargeItems) {
        const id = stableId(club.tenant.slug, 'charge-item', item.key);
        chargeItemIds.set(item.key, id);
        const row =
          (await chargeItems.findOne({ where: { id } })) ??
          chargeItems.create({ id, tenantId: club.tenant.id });
        row.name = item.name;
        row.category = item.category;
        row.defaultAmount = item.defaultAmount;
        row.currency = item.currency;
        row.isActive = item.isActive;
        await chargeItems.save(row);
      }

      const lessonIds = new Map<string, string>();
      for (const item of club.privateLessons) {
        const id = stableId(club.tenant.slug, 'private-lesson', item.key);
        lessonIds.set(item.key, id);
        const row =
          (await privateLessons.findOne({ where: { id } })) ??
          privateLessons.create({
            id,
            tenantId: club.tenant.id,
            athleteId: athleteIds.get(item.athleteKey)!,
            coachId: coachIds.get(item.coachKey)!,
            sportBranchId: branchId,
          });
        row.focus = item.focus;
        row.scheduledStart = item.scheduledStart;
        row.scheduledEnd = item.scheduledEnd;
        row.location = item.location;
        row.status = item.status;
        row.attendanceStatus = item.attendanceStatus;
        row.notes = item.notes;
        await privateLessons.save(row);
      }

      const athleteChargeIds = new Map<string, string>();
      for (const item of club.athleteCharges) {
        const id = stableId(club.tenant.slug, 'athlete-charge', item.key);
        athleteChargeIds.set(item.key, id);
        const row =
          (await athleteCharges.findOne({ where: { id } })) ??
          athleteCharges.create({
            id,
            tenantId: club.tenant.id,
            athleteId: athleteIds.get(item.athleteKey)!,
            chargeItemId: chargeItemIds.get(item.chargeItemKey)!,
          });
        row.amount = item.amount;
        row.dueDate = item.dueDate;
        row.status = item.status;
        row.notes = item.notes;
        row.privateLessonId = item.privateLessonKey ? lessonIds.get(item.privateLessonKey) ?? null : null;
        row.billingPeriodKey = item.billingPeriodKey ?? null;
        row.billingPeriodLabel = item.billingPeriodLabel ?? null;
        await athleteCharges.save(row);
      }

      for (const item of club.payments) {
        const id = stableId(club.tenant.slug, 'payment', item.key);
        const row =
          (await payments.findOne({ where: { id } })) ??
          payments.create({
            id,
            tenantId: club.tenant.id,
            athleteId: athleteIds.get(item.athleteKey)!,
          });
        row.amount = item.amount;
        row.currency = item.currency;
        row.paidAt = item.paidAt;
        row.method = item.method;
        row.reference = item.reference;
        row.notes = item.notes;
        await payments.save(row);

        for (const allocation of item.allocations) {
          const allocationId = stableId(club.tenant.slug, 'payment-allocation', item.key, allocation.chargeKey);
          const allocationRow =
            (await paymentAllocations.findOne({ where: { id: allocationId } })) ??
            paymentAllocations.create({
              id: allocationId,
              tenantId: club.tenant.id,
              paymentId: id,
              athleteChargeId: athleteChargeIds.get(allocation.chargeKey)!,
            });
          allocationRow.amount = allocation.amount;
          await paymentAllocations.save(allocationRow);
        }
      }

      for (const item of club.familyActions) {
        const id = stableId(club.tenant.slug, 'family-action', item.key);
        const row =
          (await familyActionRequests.findOne({ where: { id } })) ??
          familyActionRequests.create({
            id,
            tenantId: club.tenant.id,
            athleteId: athleteIds.get(item.athleteKey)!,
            guardianId: item.guardianKey ? guardianIds.get(item.guardianKey) ?? null : null,
          });
        row.type = item.type;
        row.status = item.status;
        row.title = item.title;
        row.description = item.description;
        row.dueDate = item.dueDate;
        row.payload = item.payload;
        row.latestResponseText = item.latestResponseText;
        row.decisionNote = item.decisionNote;
        row.submittedAt = item.submittedAt;
        row.reviewedAt = item.reviewedAt;
        row.resolvedAt = item.resolvedAt;
        await familyActionRequests.save(row);

        for (const event of item.events) {
          const eventId = stableId(club.tenant.slug, 'family-action-event', item.key, event.key);
          const eventRow =
            (await familyActionEvents.findOne({ where: { id: eventId } })) ??
            familyActionEvents.create({
              id: eventId,
              tenantId: club.tenant.id,
              familyActionRequestId: id,
            });
          eventRow.actor = event.actor;
          eventRow.eventType = event.eventType;
          eventRow.fromStatus = event.fromStatus;
          eventRow.toStatus = event.toStatus;
          eventRow.note = event.note;
          eventRow.metadata = event.metadata ?? {};
          await familyActionEvents.save(eventRow);
        }
      }

      for (const state of club.actionCenterStates) {
        const id = stableId(club.tenant.slug, 'action-center-state', state.itemKey);
        const row =
          (await actionCenterStates.findOne({ where: { id } })) ??
          actionCenterStates.create({
            id,
            tenantId: club.tenant.id,
            itemKey: state.itemKey,
          });
        row.snapshotToken = state.snapshotToken;
        row.category = state.category;
        row.type = state.type;
        row.readAt = state.readAt ?? null;
        row.dismissedAt = state.dismissedAt ?? null;
        row.completedAt = state.completedAt ?? null;
        row.snoozedUntil = state.snoozedUntil ?? null;
        row.metadata = state.metadata ?? {};
        await actionCenterStates.save(row);
      }
    }
  });
}
