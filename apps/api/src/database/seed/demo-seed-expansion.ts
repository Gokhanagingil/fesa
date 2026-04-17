/**
 * Demo seed expansion: layered on top of the base demo-seed to grow each demo
 * club from a smoke-test footprint into a stakeholder-demo footprint.
 *
 * Goals:
 *   - 18+ athletes per club, with realistic Turkish synthetic names.
 *   - 4-6 coaches with distinct specialties, reasonably distributed across
 *     groups and teams.
 *   - Guardian↔athlete relationships that mix single-guardian and
 *     two-guardian families.
 *   - Recurring training sessions with attendance, plus future planned
 *     sessions for the dashboard.
 *   - Charge items (dues, camp, jersey, tournament, private lesson) with a
 *     realistic mix of paid / pending / partially_paid / cancelled rows and
 *     overdue rows for finance dashboards.
 *   - A few private lessons with coach-athlete linkage.
 *   - Each club has a slightly different operational profile (overdue heavy,
 *     younger groups, more private lessons, more attendance).
 *
 * The expansion is idempotent: every row id is derived from
 * stableId(club.slug, kind, key, …) so re-running upserts in place. It
 * runs after the base demo seed and reuses the tenant, sport branch, age
 * group, base coach roster, group, team, and charge item rows that the base
 * seed already created.
 */

import { createHash } from 'crypto';
import { DataSource, Repository } from 'typeorm';

function expansionShirtSize(gender: 'male' | 'female', birthDate: Date): string {
  const ageYears = Math.max(6, Math.min(40, new Date(2026, 0, 1).getUTCFullYear() - birthDate.getUTCFullYear()));
  if (ageYears <= 9) return 'XS';
  if (ageYears <= 12) return 'S';
  if (ageYears <= 15) return gender === 'male' ? 'L' : 'M';
  if (ageYears <= 18) return gender === 'male' ? 'XL' : 'M';
  return gender === 'male' ? 'XL' : 'L';
}

import {
  AgeGroup,
  Athlete,
  AthleteCharge,
  AthleteGuardian,
  AthleteTeamMembership,
  Attendance,
  ChargeItem,
  ClubGroup,
  Coach,
  Guardian,
  GuardianPortalAccess,
  OutreachActivity,
  Payment,
  PaymentAllocation,
  PrivateLesson,
  SportBranch,
  Team,
  Tenant,
  TrainingSession,
} from '../entities';
import {
  AthleteChargeStatus,
  AthleteStatus,
  AttendanceStatus,
  TrainingSessionStatus,
} from '../enums';
import { CLUB_IDS, CLUB_SLUGS } from './constants';

function stableId(...parts: string[]): string {
  const digest = createHash('sha256').update(JSON.stringify(parts)).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function d(year: number, monthIndex0: number, day: number, hour = 12, minute = 0): Date {
  return new Date(Date.UTC(year, monthIndex0, day, hour, minute, 0));
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(base.getUTCDate() + days);
  return next;
}

function sessionStart(base: Date, hour: number, minute = 0): Date {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, minute, 0));
}

/**
 * Anchored 'today' for deterministic seeds. Past sessions live before this date,
 * future sessions live after. Picked to align with the base seed's anchor so
 * dashboards line up.
 */
const SEED_TODAY = d(2026, 3, 17, 0, 0); // 2026-04-17 UTC, matches the staging build day

const TURKISH_FIRST_NAMES_M = [
  'Emir', 'Ali', 'Mehmet', 'Yusuf', 'Mustafa', 'Hakan', 'Berk', 'Murat', 'Tolga', 'Onur',
  'Ege', 'Eren', 'Mert', 'Kaan', 'Sinan', 'Burak', 'Cem', 'Doruk', 'Bora', 'Arda',
  'Kerem', 'Ahmet', 'Hasan', 'Selim', 'Yiğit', 'Furkan', 'Ozan', 'Tarık',
];
const TURKISH_FIRST_NAMES_F = [
  'Zeynep', 'Elif', 'Ece', 'Defne', 'Ayşe', 'Selin', 'Derin', 'Pelin', 'Esra', 'Cansu',
  'Buse', 'Naz', 'İrem', 'Su', 'Sena', 'Lara', 'Beren', 'Doğa', 'Melis', 'Eda',
  'Begüm', 'Ada', 'Berra', 'Nehir',
];
const TURKISH_LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Aydın', 'Çelik', 'Doğan', 'Aslan', 'Polat', 'Tan',
  'Tuna', 'Akçay', 'Korkmaz', 'Bulut', 'Avcı', 'Yıldırım', 'Karaca', 'Erdem', 'Tekin', 'Toprak',
  'Uçar', 'Akar', 'Erten', 'Arslan', 'Güler', 'Öztürk',
];

type ExpansionAthlete = {
  key: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  gender: 'male' | 'female';
  status: AthleteStatus;
  jerseyNumber: string | null;
  groupKey: string;
  teamKeys: string[];
  notes: string | null;
  guardians: Array<{
    guardianKey: string;
    relationshipType: string;
    isPrimary: boolean;
  }>;
};

type ExpansionGuardian = {
  key: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type ExpansionCoach = {
  key: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  specialties: string;
  notes: string;
  isActive?: boolean;
};

type ExpansionGroup = {
  key: string;
  name: string;
  ageGroupKey: string;
  headCoachKey: string;
};

type ExpansionTeam = {
  key: string;
  name: string;
  code: string;
  groupKey: string;
  headCoachKey: string;
};

type ExpansionAgeGroup = {
  key: string;
  label: string;
  birthYearFrom: number;
  birthYearTo: number;
};

type ExpansionTrainingSession = {
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
};

type ExpansionAttendance = {
  sessionKey: string;
  athleteKey: string;
  status: AttendanceStatus;
  note: string | null;
};

type ExpansionChargeItem = {
  key: string;
  name: string;
  category: string;
  defaultAmount: string;
  currency: string;
};

type ExpansionPrivateLesson = {
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
};

type ExpansionAthleteCharge = {
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
};

type ExpansionPayment = {
  key: string;
  athleteKey: string;
  amount: string;
  currency: string;
  paidAt: Date;
  method: string | null;
  reference: string | null;
  notes: string | null;
  allocations: Array<{ chargeKey: string; amount: string }>;
};

type ExpansionClub = {
  tenantId: string;
  tenantSlug: string;
  /** Profile knobs to vary club personalities. */
  profile: {
    /** Number of additional athletes to generate (on top of the 3-5 base seeds). */
    extraAthletes: number;
    /** Probability (0-1) that an athlete has 2 guardians. */
    twoGuardianRate: number;
    /** Probability that an athlete is on the 'overdue' lane. */
    overdueRate: number;
    /** Probability of trial status. */
    trialRate: number;
    /** Probability of paused status. */
    pausedRate: number;
    /** Number of recurring weekly training sessions to materialize. */
    recurringSessionWeeks: number;
    /** Number of upcoming planned sessions in the future window. */
    upcomingSessions: number;
    /** Number of additional private lessons. */
    privateLessons: number;
  };
  ageGroups: ExpansionAgeGroup[];
  groups: ExpansionGroup[];
  teams: ExpansionTeam[];
  coaches: ExpansionCoach[];
  chargeItems: ExpansionChargeItem[];
  privateLessons: ExpansionPrivateLesson[];
};

const CLUB_BASE_BRANCH_KEY: Record<string, 'basketball' | 'volleyball' | 'football'> = {
  [CLUB_SLUGS.kadikoy]: 'basketball',
  [CLUB_SLUGS.fesa]: 'basketball',
  [CLUB_SLUGS.moda]: 'volleyball',
  [CLUB_SLUGS.marmara]: 'football',
};

function buildClubExpansionConfig(): ExpansionClub[] {
  return [
    {
      tenantId: CLUB_IDS.kadikoy,
      tenantSlug: CLUB_SLUGS.kadikoy,
      profile: {
        extraAthletes: 22,
        twoGuardianRate: 0.45,
        overdueRate: 0.18,
        trialRate: 0.1,
        pausedRate: 0.05,
        recurringSessionWeeks: 6,
        upcomingSessions: 4,
        privateLessons: 3,
      },
      ageGroups: [
        { key: 'expansion-u10', label: 'U10', birthYearFrom: 2015, birthYearTo: 2016 },
        { key: 'expansion-u18', label: 'U18', birthYearFrom: 2007, birthYearTo: 2008 },
      ],
      groups: [
        { key: 'expansion-bb-u10', name: 'Basketball · U10 mini', ageGroupKey: 'expansion-u10', headCoachKey: 'expansion-cenk' },
        { key: 'expansion-bb-u16', name: 'Basketball · U16 development', ageGroupKey: 'u16', headCoachKey: 'expansion-yasin' },
        { key: 'expansion-bb-u18', name: 'Basketball · U18 academy', ageGroupKey: 'expansion-u18', headCoachKey: 'expansion-yasin' },
      ],
      teams: [
        { key: 'expansion-bb-u16-a', name: 'U16 A', code: 'BB-U16-A', groupKey: 'expansion-bb-u16', headCoachKey: 'expansion-yasin' },
        { key: 'expansion-bb-u18-a', name: 'U18 Showcase', code: 'BB-U18-S', groupKey: 'expansion-bb-u18', headCoachKey: 'expansion-yasin' },
      ],
      coaches: [
        { key: 'expansion-cenk', firstName: 'Cenk', lastName: 'Yıldırım', phone: '+90 535 100 0220', email: 'cenk.yildirim@kadikoygenc.local', specialties: 'mini basket, motor skills', notes: 'Mini basket lead coach.' },
        { key: 'expansion-yasin', firstName: 'Yasin', lastName: 'Aksoy', phone: '+90 535 100 0221', email: 'yasin.aksoy@kadikoygenc.local', specialties: 'U16 / U18 development', notes: 'Older youth squad lead.' },
        { key: 'expansion-deniz', firstName: 'Deniz', lastName: 'Korkmaz', phone: '+90 535 100 0222', email: 'deniz.korkmaz@kadikoygenc.local', specialties: 'strength, conditioning', notes: 'Cross-group conditioning.' },
        { key: 'expansion-erol', firstName: 'Erol', lastName: 'Bulut', phone: '+90 535 100 0223', email: 'erol.bulut@kadikoygenc.local', specialties: 'video, scouting', notes: 'Match film and player feedback.', isActive: false },
      ],
      chargeItems: [
        { key: 'expansion-coach-fee', name: 'Personal coaching package', category: 'private_lesson', defaultAmount: '4500.00', currency: 'TRY' },
        { key: 'expansion-tour-bus', name: 'Tournament bus contribution', category: 'tournament', defaultAmount: '450.00', currency: 'TRY' },
      ],
      privateLessons: [
        {
          key: 'expansion-pl-1',
          athleteKey: 'gen-3',
          coachKey: 'expansion-cenk',
          focus: 'Crossover footwork',
          scheduledStart: sessionStart(addDays(SEED_TODAY, 2), 16),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, 2), 17),
          location: 'Caferağa Sports Hall — Court 3',
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: 'Family asked for extra reps after recent district scrimmage.',
        },
        {
          key: 'expansion-pl-2',
          athleteKey: 'gen-7',
          coachKey: 'expansion-yasin',
          focus: 'Pull-up shooting under fatigue',
          scheduledStart: sessionStart(addDays(SEED_TODAY, -3), 17),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, -3), 18),
          location: 'Caferağa Sports Hall — Court 3',
          status: TrainingSessionStatus.COMPLETED,
          attendanceStatus: AttendanceStatus.PRESENT,
          notes: 'Solid session, follow-up in two weeks.',
        },
        {
          key: 'expansion-pl-3',
          athleteKey: 'gen-11',
          coachKey: 'expansion-yasin',
          focus: null,
          scheduledStart: sessionStart(addDays(SEED_TODAY, 5), 14),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, 5), 15),
          location: null,
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: 'Focus / location intentionally blank to surface in the action center.',
        },
      ],
    },
    {
      tenantId: CLUB_IDS.fesa,
      tenantSlug: CLUB_SLUGS.fesa,
      profile: {
        extraAthletes: 24,
        twoGuardianRate: 0.5,
        overdueRate: 0.12,
        trialRate: 0.12,
        pausedRate: 0.04,
        recurringSessionWeeks: 6,
        upcomingSessions: 5,
        privateLessons: 4,
      },
      ageGroups: [
        { key: 'expansion-u8', label: 'U8', birthYearFrom: 2017, birthYearTo: 2018 },
        { key: 'expansion-u15', label: 'U15', birthYearFrom: 2010, birthYearTo: 2011 },
      ],
      groups: [
        { key: 'expansion-bb-u8', name: 'Mini basket · U8 starters', ageGroupKey: 'expansion-u8', headCoachKey: 'expansion-irem' },
        { key: 'expansion-bb-u15', name: 'Performance · U15', ageGroupKey: 'expansion-u15', headCoachKey: 'expansion-mert' },
      ],
      teams: [
        { key: 'expansion-fesa-u15-a', name: 'U15 A', code: 'FESA-U15-A', groupKey: 'expansion-bb-u15', headCoachKey: 'expansion-mert' },
        { key: 'expansion-fesa-u15-b', name: 'U15 B', code: 'FESA-U15-B', groupKey: 'expansion-bb-u15', headCoachKey: 'expansion-volkan' },
      ],
      coaches: [
        { key: 'expansion-irem', firstName: 'İrem', lastName: 'Doğan', phone: '+90 531 401 0301', email: 'irem.dogan@fesabasketbol.local', specialties: 'mini basket, parent education', notes: 'Mini basket family communications lead.' },
        { key: 'expansion-mert', firstName: 'Mert', lastName: 'Aslan', phone: '+90 531 401 0302', email: 'mert.aslan@fesabasketbol.local', specialties: 'U15 ball-handling', notes: 'U15 head coach.' },
        { key: 'expansion-volkan', firstName: 'Volkan', lastName: 'Şahin', phone: '+90 531 401 0303', email: 'volkan.sahin@fesabasketbol.local', specialties: 'U15 second team', notes: 'U15 development squad.' },
        { key: 'expansion-pinar', firstName: 'Pınar', lastName: 'Avcı', phone: '+90 531 401 0304', email: 'pinar.avci@fesabasketbol.local', specialties: 'goalkeeping (cross-sport), readiness', notes: 'Family readiness liaison.' },
      ],
      chargeItems: [
        { key: 'expansion-camp-summer', name: 'Summer day camp', category: 'camp', defaultAmount: '3800.00', currency: 'TRY' },
        { key: 'expansion-academy-shoes', name: 'Academy shoes voucher', category: 'merchandise', defaultAmount: '900.00', currency: 'TRY' },
      ],
      privateLessons: [
        {
          key: 'expansion-pl-fesa-1',
          athleteKey: 'gen-2',
          coachKey: 'expansion-mert',
          focus: 'Shooting form reset',
          scheduledStart: sessionStart(addDays(SEED_TODAY, 1), 17),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, 1), 18),
          location: 'Fesa Skill Lab',
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: 'Quarter check-in for U15 A starting guard.',
        },
        {
          key: 'expansion-pl-fesa-2',
          athleteKey: 'gen-9',
          coachKey: 'expansion-volkan',
          focus: 'Defensive stance',
          scheduledStart: sessionStart(addDays(SEED_TODAY, 8), 16),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, 8), 17),
          location: 'Fesa Skill Lab',
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: null,
        },
        {
          key: 'expansion-pl-fesa-3',
          athleteKey: 'gen-14',
          coachKey: 'expansion-mert',
          focus: 'Decision making vs trap',
          scheduledStart: sessionStart(addDays(SEED_TODAY, -7), 17),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, -7), 18),
          location: 'Fesa Skill Lab',
          status: TrainingSessionStatus.COMPLETED,
          attendanceStatus: AttendanceStatus.PRESENT,
          notes: 'Strong session.',
        },
        {
          key: 'expansion-pl-fesa-4',
          athleteKey: 'gen-18',
          coachKey: 'expansion-mert',
          focus: null,
          scheduledStart: sessionStart(addDays(SEED_TODAY, 4), 18),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, 4), 19),
          location: null,
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: 'Intentionally missing focus / location to surface in action center.',
        },
      ],
    },
    {
      tenantId: CLUB_IDS.moda,
      tenantSlug: CLUB_SLUGS.moda,
      profile: {
        extraAthletes: 19,
        twoGuardianRate: 0.4,
        overdueRate: 0.22,
        trialRate: 0.05,
        pausedRate: 0.08,
        recurringSessionWeeks: 5,
        upcomingSessions: 3,
        privateLessons: 2,
      },
      ageGroups: [
        { key: 'expansion-u11', label: 'U11', birthYearFrom: 2014, birthYearTo: 2015 },
        { key: 'expansion-u17', label: 'U17', birthYearFrom: 2008, birthYearTo: 2009 },
      ],
      groups: [
        { key: 'expansion-vb-u11', name: 'Volley starter · U11', ageGroupKey: 'expansion-u11', headCoachKey: 'expansion-elif' },
        { key: 'expansion-vb-u17', name: 'Performance · U17', ageGroupKey: 'expansion-u17', headCoachKey: 'expansion-orhan' },
      ],
      teams: [
        { key: 'expansion-moda-u17-a', name: 'U17 Match Squad', code: 'MODA-U17-A', groupKey: 'expansion-vb-u17', headCoachKey: 'expansion-orhan' },
      ],
      coaches: [
        { key: 'expansion-elif', firstName: 'Elif', lastName: 'Tan', phone: '+90 535 310 0301', email: 'elif.tan@modavoleybol.local', specialties: 'reception fundamentals', notes: 'Starter group lead.' },
        { key: 'expansion-orhan', firstName: 'Orhan', lastName: 'Erdem', phone: '+90 535 310 0302', email: 'orhan.erdem@modavoleybol.local', specialties: 'U17 attack, blocking', notes: 'Performance squad head.' },
        { key: 'expansion-buse', firstName: 'Buse', lastName: 'Tuna', phone: '+90 535 310 0303', email: 'buse.tuna@modavoleybol.local', specialties: 'setting, libero', notes: 'Skill specialist.' },
      ],
      chargeItems: [
        { key: 'expansion-tournament-uniform', name: 'Tournament uniform set', category: 'merchandise', defaultAmount: '1450.00', currency: 'TRY' },
        { key: 'expansion-coach-private', name: 'Volleyball private coaching', category: 'private_lesson', defaultAmount: '1500.00', currency: 'TRY' },
      ],
      privateLessons: [
        {
          key: 'expansion-pl-moda-1',
          athleteKey: 'gen-4',
          coachKey: 'expansion-buse',
          focus: 'Setting tempo with middle hitter',
          scheduledStart: sessionStart(addDays(SEED_TODAY, 6), 15),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, 6), 16),
          location: 'Moda Volleyball Annex — Court B',
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: 'Family approved, payment scheduled.',
        },
        {
          key: 'expansion-pl-moda-2',
          athleteKey: 'gen-12',
          coachKey: 'expansion-orhan',
          focus: 'Passing under pressure',
          scheduledStart: sessionStart(addDays(SEED_TODAY, -10), 16),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, -10), 17),
          location: 'Moda Volleyball Annex — Court B',
          status: TrainingSessionStatus.COMPLETED,
          attendanceStatus: AttendanceStatus.PRESENT,
          notes: null,
        },
      ],
    },
    {
      tenantId: CLUB_IDS.marmara,
      tenantSlug: CLUB_SLUGS.marmara,
      profile: {
        extraAthletes: 26,
        twoGuardianRate: 0.55,
        overdueRate: 0.16,
        trialRate: 0.08,
        pausedRate: 0.07,
        recurringSessionWeeks: 7,
        upcomingSessions: 4,
        privateLessons: 2,
      },
      ageGroups: [
        { key: 'expansion-u9', label: 'U9', birthYearFrom: 2016, birthYearTo: 2017 },
        { key: 'expansion-u14', label: 'U14', birthYearFrom: 2011, birthYearTo: 2012 },
      ],
      groups: [
        { key: 'expansion-fb-u9', name: 'Football starter · U9', ageGroupKey: 'expansion-u9', headCoachKey: 'expansion-mehmet-2' },
        { key: 'expansion-fb-u14', name: 'Football academy · U14', ageGroupKey: 'expansion-u14', headCoachKey: 'expansion-baris' },
      ],
      teams: [
        { key: 'expansion-mfo-u14-blue', name: 'U14 Blue Squad', code: 'MFO-U14-B', groupKey: 'expansion-fb-u14', headCoachKey: 'expansion-baris' },
        { key: 'expansion-mfo-u14-white', name: 'U14 White Squad', code: 'MFO-U14-W', groupKey: 'expansion-fb-u14', headCoachKey: 'expansion-tarik' },
      ],
      coaches: [
        { key: 'expansion-baris', firstName: 'Barış', lastName: 'Karaca', phone: '+90 535 410 0301', email: 'baris.karaca@marmarafutbol.local', specialties: 'U14 attack, set-pieces', notes: 'U14 head coach.' },
        { key: 'expansion-mehmet-2', firstName: 'Mehmet', lastName: 'Akar', phone: '+90 535 410 0302', email: 'mehmet.akar@marmarafutbol.local', specialties: 'starter group, motor skills', notes: 'U9 foundation lead.' },
        { key: 'expansion-tarik', firstName: 'Tarık', lastName: 'Toprak', phone: '+90 535 410 0303', email: 'tarik.toprak@marmarafutbol.local', specialties: 'U14 defense', notes: 'White squad coach.' },
        { key: 'expansion-defne', firstName: 'Defne', lastName: 'Polat', phone: '+90 535 410 0304', email: 'defne.polat@marmarafutbol.local', specialties: 'goalkeeping, GK clinics', notes: 'Cross-group GK coach.' },
      ],
      chargeItems: [
        { key: 'expansion-tour-pack', name: 'Spring tournament pack', category: 'tournament', defaultAmount: '2400.00', currency: 'TRY' },
        { key: 'expansion-rain-jacket', name: 'Rain training jacket', category: 'merchandise', defaultAmount: '950.00', currency: 'TRY' },
      ],
      privateLessons: [
        {
          key: 'expansion-pl-mfo-1',
          athleteKey: 'gen-5',
          coachKey: 'expansion-defne',
          focus: 'Goalkeeper diving plane',
          scheduledStart: sessionStart(addDays(SEED_TODAY, 3), 17),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, 3), 18),
          location: 'Marmara Side Pitch',
          status: TrainingSessionStatus.PLANNED,
          attendanceStatus: null,
          notes: null,
        },
        {
          key: 'expansion-pl-mfo-2',
          athleteKey: 'gen-15',
          coachKey: 'expansion-baris',
          focus: 'First touch under pressure',
          scheduledStart: sessionStart(addDays(SEED_TODAY, -5), 18),
          scheduledEnd: sessionStart(addDays(SEED_TODAY, -5), 19),
          location: 'Marmara Grass Pitch',
          status: TrainingSessionStatus.COMPLETED,
          attendanceStatus: AttendanceStatus.PRESENT,
          notes: null,
        },
      ],
    },
  ];
}

/**
 * Mulberry32 deterministic PRNG so a stable tenant slug yields the same set of
 * generated rows every run.
 */
function createSeededRng(seed: string): () => number {
  let state =
    Array.from(seed).reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 0) || 0xdeadbeef;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function birthDateForGroup(group: ExpansionGroup, ageGroups: Map<string, ExpansionAgeGroup>, rng: () => number): Date {
  const ag = ageGroups.get(group.ageGroupKey);
  if (!ag) {
    return d(2014, 0, 15);
  }
  const span = Math.max(ag.birthYearTo - ag.birthYearFrom, 0);
  const year = ag.birthYearFrom + Math.floor(rng() * (span + 1));
  const month = Math.floor(rng() * 12);
  const day = 1 + Math.floor(rng() * 27);
  return d(year, month, day);
}

function generateAthletes(
  club: ExpansionClub,
  ageGroups: Map<string, ExpansionAgeGroup>,
  groupKeys: string[],
  teamsByGroup: Map<string, string[]>,
  guardians: ExpansionGuardian[],
): ExpansionAthlete[] {
  const rng = createSeededRng(`${club.tenantSlug}:athletes`);
  const athletes: ExpansionAthlete[] = [];
  const guardianKeys = guardians.map((g) => g.key);

  for (let index = 0; index < club.profile.extraAthletes; index += 1) {
    const isMale = rng() < 0.55;
    const firstName = pick(rng, isMale ? TURKISH_FIRST_NAMES_M : TURKISH_FIRST_NAMES_F);
    const lastName = pick(rng, TURKISH_LAST_NAMES);
    const groupKey = groupKeys[index % groupKeys.length];
    const teamPool = teamsByGroup.get(groupKey) ?? [];
    const teamKeys: string[] = [];
    if (teamPool.length > 0 && rng() < 0.55) {
      teamKeys.push(teamPool[index % teamPool.length]);
    }

    let status: AthleteStatus = AthleteStatus.ACTIVE;
    const statusRoll = rng();
    if (statusRoll < club.profile.trialRate) {
      status = AthleteStatus.TRIAL;
    } else if (statusRoll < club.profile.trialRate + club.profile.pausedRate) {
      status = AthleteStatus.PAUSED;
    }

    const groupConfig = club.groups.find((g) => g.key === groupKey)!;
    const birthDate = birthDateForGroup(groupConfig, ageGroups, rng);

    const primaryGuardianKey = guardianKeys[index % guardianKeys.length];
    const athleteGuardians: ExpansionAthlete['guardians'] = [
      {
        guardianKey: primaryGuardianKey,
        relationshipType: isMale ? 'father' : 'mother',
        isPrimary: true,
      },
    ];
    if (rng() < club.profile.twoGuardianRate) {
      const secondaryKey = guardianKeys[(index + 7) % guardianKeys.length];
      if (secondaryKey !== primaryGuardianKey) {
        athleteGuardians.push({
          guardianKey: secondaryKey,
          relationshipType: 'guardian',
          isPrimary: false,
        });
      }
    }

    athletes.push({
      key: `gen-${index}`,
      firstName,
      lastName,
      birthDate,
      gender: isMale ? 'male' : 'female',
      status,
      jerseyNumber: rng() < 0.5 ? String(2 + Math.floor(rng() * 27)) : null,
      groupKey,
      teamKeys,
      notes: rng() < 0.25 ? 'Notes synthesized for staging walkthrough.' : null,
      guardians: athleteGuardians,
    });
  }

  return athletes;
}

function generateGuardians(club: ExpansionClub): ExpansionGuardian[] {
  const rng = createSeededRng(`${club.tenantSlug}:guardians`);
  const desired = Math.max(8, Math.ceil(club.profile.extraAthletes * 0.7));
  const guardians: ExpansionGuardian[] = [];
  for (let index = 0; index < desired; index += 1) {
    const isFemale = rng() < 0.55;
    const firstName = pick(rng, isFemale ? TURKISH_FIRST_NAMES_F : TURKISH_FIRST_NAMES_M);
    const lastName = pick(rng, TURKISH_LAST_NAMES);
    guardians.push({
      key: `g-${index}`,
      firstName,
      lastName,
      phone: rng() < 0.85 ? `+90 5${30 + Math.floor(rng() * 9)}${String(100 + Math.floor(rng() * 800)).padStart(3, '0')} ${String(1000 + Math.floor(rng() * 8999))}` : null,
      email: rng() < 0.85 ? `${firstName.toLowerCase().replace(/[^a-z]/g, '')}.${lastName.toLowerCase().replace(/[^a-z]/g, '')}${index}@example.com` : null,
      notes: rng() < 0.18 ? 'Prefers SMS reminders.' : null,
    });
  }
  return guardians;
}

function generateRecurringSessions(club: ExpansionClub): ExpansionTrainingSession[] {
  const rng = createSeededRng(`${club.tenantSlug}:sessions`);
  const sessions: ExpansionTrainingSession[] = [];

  // Past recurring sessions per group.
  for (const group of club.groups) {
    for (let week = 0; week < club.profile.recurringSessionWeeks; week += 1) {
      const dayOffset = -((club.profile.recurringSessionWeeks - week) * 7) + 1;
      const baseDate = addDays(SEED_TODAY, dayOffset);
      const startHour = 16 + Math.floor(rng() * 3);
      sessions.push({
        key: `recur-${group.key}-w${week}`,
        title: `${group.name} · Weekly practice`,
        groupKey: group.key,
        teamKey: null,
        coachKey: group.headCoachKey,
        scheduledStart: sessionStart(baseDate, startHour),
        scheduledEnd: sessionStart(baseDate, startHour + 1, 30),
        location: pick(rng, [
          `${club.tenantSlug.split('-')[0]} hall — Court A`,
          `${club.tenantSlug.split('-')[0]} hall — Court B`,
          `${club.tenantSlug.split('-')[0]} field — North`,
        ]),
        status: TrainingSessionStatus.COMPLETED,
        notes: null,
      });
    }
  }

  // Upcoming planned sessions.
  for (let i = 0; i < club.profile.upcomingSessions; i += 1) {
    const group = club.groups[i % club.groups.length];
    const dayOffset = 1 + i * 2;
    const baseDate = addDays(SEED_TODAY, dayOffset);
    const startHour = 17 + (i % 2);
    sessions.push({
      key: `upcoming-${i}`,
      title: `${group.name} · Upcoming session ${i + 1}`,
      groupKey: group.key,
      teamKey: null,
      coachKey: i % 2 === 0 ? group.headCoachKey : null,
      scheduledStart: sessionStart(baseDate, startHour),
      scheduledEnd: sessionStart(baseDate, startHour + 1, 15),
      location: i % 3 === 0 ? null : `${club.tenantSlug.split('-')[0]} hall — Court ${String.fromCharCode(65 + (i % 3))}`,
      status: TrainingSessionStatus.PLANNED,
      notes: null,
    });
  }

  return sessions;
}

function generateAttendance(
  club: ExpansionClub,
  sessions: ExpansionTrainingSession[],
  athletes: ExpansionAthlete[],
): ExpansionAttendance[] {
  const rng = createSeededRng(`${club.tenantSlug}:attendance`);
  const records: ExpansionAttendance[] = [];

  for (const session of sessions) {
    if (session.status !== TrainingSessionStatus.COMPLETED) {
      continue;
    }
    const candidates = athletes.filter((athlete) => athlete.groupKey === session.groupKey);
    for (const athlete of candidates) {
      if (athlete.status === AthleteStatus.PAUSED && rng() < 0.7) {
        continue;
      }
      const roll = rng();
      let status: AttendanceStatus;
      if (roll < 0.78) status = AttendanceStatus.PRESENT;
      else if (roll < 0.88) status = AttendanceStatus.LATE;
      else if (roll < 0.94) status = AttendanceStatus.EXCUSED;
      else status = AttendanceStatus.ABSENT;
      records.push({
        sessionKey: session.key,
        athleteKey: athlete.key,
        status,
        note: status === AttendanceStatus.LATE ? 'Arrived after warm-up' : status === AttendanceStatus.EXCUSED ? 'School commitment' : null,
      });
    }
  }

  return records;
}

function generateCharges(
  club: ExpansionClub,
  athletes: ExpansionAthlete[],
  chargeItems: ExpansionChargeItem[],
): { charges: ExpansionAthleteCharge[]; payments: ExpansionPayment[] } {
  const rng = createSeededRng(`${club.tenantSlug}:charges`);
  const charges: ExpansionAthleteCharge[] = [];
  const payments: ExpansionPayment[] = [];

  const duesItem = chargeItems.find((item) => item.category === 'dues');
  const merchItem = chargeItems.find((item) => item.category === 'merchandise');
  const tournamentItem = chargeItems.find((item) => item.category === 'tournament');
  const campItem = chargeItems.find((item) => item.category === 'camp');

  athletes.forEach((athlete, index) => {
    if (athlete.status === AthleteStatus.ARCHIVED) {
      return;
    }

    // Monthly dues for the past 3 months — most paid, some pending.
    if (duesItem) {
      for (let month = -2; month <= 0; month += 1) {
        const dueDate = d(SEED_TODAY.getUTCFullYear(), SEED_TODAY.getUTCMonth() + month, 5);
        const periodKey = `${dueDate.getUTCFullYear()}-${String(dueDate.getUTCMonth() + 1).padStart(2, '0')}`;
        const isCurrentMonth = month === 0;
        const isLastMonth = month === -1;
        const isOverdueLane = rng() < club.profile.overdueRate;

        let status: AthleteChargeStatus = AthleteChargeStatus.PAID;
        if (isCurrentMonth) {
          status = isOverdueLane ? AthleteChargeStatus.PENDING : (rng() < 0.4 ? AthleteChargeStatus.PARTIALLY_PAID : AthleteChargeStatus.PAID);
        } else if (isLastMonth) {
          status = isOverdueLane ? AthleteChargeStatus.PARTIALLY_PAID : AthleteChargeStatus.PAID;
        }
        if (athlete.status === AthleteStatus.PAUSED && month === 0) {
          status = AthleteChargeStatus.CANCELLED;
        }

        const chargeKey = `dues-${athlete.key}-${periodKey}`;
        charges.push({
          key: chargeKey,
          athleteKey: athlete.key,
          chargeItemKey: duesItem.key,
          amount: duesItem.defaultAmount,
          dueDate,
          status,
          notes: null,
          billingPeriodKey: periodKey,
          billingPeriodLabel: `${periodKey} dues`,
        });

        if (status === AthleteChargeStatus.PAID || status === AthleteChargeStatus.PARTIALLY_PAID) {
          const portion = status === AthleteChargeStatus.PAID
            ? duesItem.defaultAmount
            : (Number(duesItem.defaultAmount) * 0.5).toFixed(2);
          const paidAt = addDays(dueDate, status === AthleteChargeStatus.PAID ? -1 : 5);
          payments.push({
            key: `pay-${chargeKey}`,
            athleteKey: athlete.key,
            amount: portion,
            currency: duesItem.currency,
            paidAt,
            method: pick(rng, ['transfer', 'cash', 'pos']),
            reference: `DUES-${periodKey}-${index}`,
            notes: null,
            allocations: [{ chargeKey, amount: portion }],
          });
        }
      }
    }

    // A few one-off charges sprinkled across athletes.
    if (merchItem && index % 4 === 0) {
      const dueDate = addDays(SEED_TODAY, 14);
      charges.push({
        key: `merch-${athlete.key}`,
        athleteKey: athlete.key,
        chargeItemKey: merchItem.key,
        amount: merchItem.defaultAmount,
        dueDate,
        status: rng() < 0.5 ? AthleteChargeStatus.PENDING : AthleteChargeStatus.PAID,
        notes: null,
      });
    }

    if (tournamentItem && index % 5 === 1) {
      const dueDate = addDays(SEED_TODAY, 28);
      charges.push({
        key: `tour-${athlete.key}`,
        athleteKey: athlete.key,
        chargeItemKey: tournamentItem.key,
        amount: tournamentItem.defaultAmount,
        dueDate,
        status: AthleteChargeStatus.PENDING,
        notes: 'Optional tournament participation.',
      });
    }

    if (campItem && index % 6 === 2) {
      const dueDate = addDays(SEED_TODAY, 45);
      charges.push({
        key: `camp-${athlete.key}`,
        athleteKey: athlete.key,
        chargeItemKey: campItem.key,
        amount: campItem.defaultAmount,
        dueDate,
        status: AthleteChargeStatus.PENDING,
        notes: 'Camp slot reserved.',
      });
    }
  });

  return { charges, payments };
}

async function ensureExpansionAgeGroups(
  club: ExpansionClub,
  ageGroups: Repository<AgeGroup>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of club.ageGroups) {
    const id = stableId(club.tenantSlug, 'expansion-age', seed.key);
    ids.set(seed.key, id);
    const row =
      (await ageGroups.findOne({ where: { id } })) ??
      ageGroups.create({ id, tenantId: club.tenantId });
    row.label = seed.label;
    row.birthYearFrom = seed.birthYearFrom;
    row.birthYearTo = seed.birthYearTo;
    await ageGroups.save(row);
  }
  return ids;
}

async function ensureExpansionCoaches(
  club: ExpansionClub,
  coaches: Repository<Coach>,
  branchId: string,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of club.coaches) {
    const id = stableId(club.tenantSlug, 'expansion-coach', seed.key);
    ids.set(seed.key, id);
    const row =
      (await coaches.findOne({ where: { id } })) ??
      coaches.create({ id, tenantId: club.tenantId, sportBranchId: branchId });
    row.firstName = seed.firstName;
    row.lastName = seed.lastName;
    row.preferredName = null;
    row.phone = seed.phone;
    row.email = seed.email;
    row.specialties = seed.specialties;
    row.notes = seed.notes;
    row.isActive = seed.isActive ?? true;
    await coaches.save(row);
  }
  return ids;
}

async function ensureExpansionGroups(
  club: ExpansionClub,
  groups: Repository<ClubGroup>,
  branchId: string,
  baseAgeGroupIds: Map<string, string>,
  expansionAgeGroupIds: Map<string, string>,
  coachIdResolver: (key: string) => string,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of club.groups) {
    const id = stableId(club.tenantSlug, 'expansion-group', seed.key);
    ids.set(seed.key, id);
    const row =
      (await groups.findOne({ where: { id } })) ??
      groups.create({ id, tenantId: club.tenantId, sportBranchId: branchId });
    row.name = seed.name;
    const ageGroupId = expansionAgeGroupIds.get(seed.ageGroupKey) ?? baseAgeGroupIds.get(seed.ageGroupKey) ?? null;
    row.ageGroupId = ageGroupId;
    row.headCoachId = coachIdResolver(seed.headCoachKey);
    await groups.save(row);
  }
  return ids;
}

async function ensureExpansionTeams(
  club: ExpansionClub,
  teams: Repository<Team>,
  branchId: string,
  groupIds: Map<string, string>,
  coachIdResolver: (key: string) => string,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of club.teams) {
    const id = stableId(club.tenantSlug, 'expansion-team', seed.key);
    ids.set(seed.key, id);
    const row =
      (await teams.findOne({ where: { id } })) ??
      teams.create({ id, tenantId: club.tenantId, sportBranchId: branchId });
    row.name = seed.name;
    row.code = seed.code;
    row.groupId = groupIds.get(seed.groupKey) ?? null;
    row.headCoachId = coachIdResolver(seed.headCoachKey);
    await teams.save(row);
  }
  return ids;
}

async function ensureExpansionGuardians(
  club: ExpansionClub,
  list: ExpansionGuardian[],
  guardians: Repository<Guardian>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of list) {
    const id = stableId(club.tenantSlug, 'expansion-guardian', seed.key);
    ids.set(seed.key, id);
    const row =
      (await guardians.findOne({ where: { id } })) ??
      guardians.create({ id, tenantId: club.tenantId });
    row.firstName = seed.firstName;
    row.lastName = seed.lastName;
    row.phone = seed.phone;
    row.email = seed.email;
    row.notes = seed.notes;
    await guardians.save(row);
  }
  return ids;
}

async function ensureExpansionAthletes(
  club: ExpansionClub,
  list: ExpansionAthlete[],
  athletes: Repository<Athlete>,
  athleteGuardians: Repository<AthleteGuardian>,
  guardianIds: Map<string, string>,
  branchId: string,
  groupIds: Map<string, string>,
  teamIds: Map<string, string>,
  memberships: Repository<AthleteTeamMembership>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of list) {
    const id = stableId(club.tenantSlug, 'expansion-athlete', seed.key);
    ids.set(seed.key, id);
    const row =
      (await athletes.findOne({ where: { id } })) ??
      athletes.create({ id, tenantId: club.tenantId, sportBranchId: branchId });
    row.firstName = seed.firstName;
    row.lastName = seed.lastName;
    row.preferredName = null;
    row.birthDate = seed.birthDate;
    row.gender = seed.gender;
    row.status = seed.status;
    row.jerseyNumber = seed.jerseyNumber;
    row.shirtSize = expansionShirtSize(seed.gender, seed.birthDate);
    row.primaryGroupId = groupIds.get(seed.groupKey) ?? null;
    row.notes = seed.notes;
    await athletes.save(row);

    for (const link of seed.guardians) {
      const guardianId = guardianIds.get(link.guardianKey);
      if (!guardianId) continue;
      const linkId = stableId(club.tenantSlug, 'expansion-athlete-guardian', seed.key, link.guardianKey);
      const linkRow =
        (await athleteGuardians.findOne({ where: { id: linkId } })) ??
        athleteGuardians.create({
          id: linkId,
          tenantId: club.tenantId,
          athleteId: id,
          guardianId,
        });
      linkRow.relationshipType = link.relationshipType;
      linkRow.isPrimaryContact = link.isPrimary;
      linkRow.notes = null;
      await athleteGuardians.save(linkRow);
    }

    for (const teamKey of seed.teamKeys) {
      const teamId = teamIds.get(teamKey);
      if (!teamId) continue;
      const membershipId = stableId(club.tenantSlug, 'expansion-athlete-team', seed.key, teamKey);
      const membership =
        (await memberships.findOne({ where: { id: membershipId } })) ??
        memberships.create({
          id: membershipId,
          tenantId: club.tenantId,
          athleteId: id,
          teamId,
        });
      membership.startedAt = d(2025, 8, 1);
      membership.endedAt = null;
      await memberships.save(membership);
    }
  }
  return ids;
}

async function ensureExpansionPortalAccess(
  club: ExpansionClub,
  guardiansList: ExpansionGuardian[],
  guardianIds: Map<string, string>,
  portalAccesses: Repository<GuardianPortalAccess>,
): Promise<void> {
  // Activate portal for the first 3 guardians to keep dashboard counts non-zero
  // without flooding the portal access list.
  const candidates = guardiansList.slice(0, 3);
  for (const guardian of candidates) {
    const guardianId = guardianIds.get(guardian.key);
    if (!guardianId) continue;
    const id = stableId(club.tenantSlug, 'expansion-portal', guardian.key);
    const row =
      (await portalAccesses.findOne({ where: { id } })) ??
      portalAccesses.create({ id, tenantId: club.tenantId, guardianId });
    row.email = guardian.email ?? `${guardian.key}@${club.tenantSlug}.local`;
    row.status = 'invited';
    row.invitedAt = addDays(SEED_TODAY, -10);
    row.activatedAt = null;
    row.lastLoginAt = null;
    row.disabledAt = null;
    row.inviteTokenHash = null;
    row.inviteTokenExpiresAt = null;
    await portalAccesses.save(row);
  }
}

async function ensureExpansionTrainingSessions(
  club: ExpansionClub,
  list: ExpansionTrainingSession[],
  sessions: Repository<TrainingSession>,
  branchId: string,
  groupIds: Map<string, string>,
  teamIds: Map<string, string>,
  coachIdResolver: (key: string) => string | null,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of list) {
    const id = stableId(club.tenantSlug, 'expansion-session', seed.key);
    ids.set(seed.key, id);
    const groupId = groupIds.get(seed.groupKey);
    if (!groupId) continue;
    const row =
      (await sessions.findOne({ where: { id } })) ??
      sessions.create({
        id,
        tenantId: club.tenantId,
        sportBranchId: branchId,
        groupId,
      });
    row.title = seed.title;
    row.teamId = seed.teamKey ? teamIds.get(seed.teamKey) ?? null : null;
    row.coachId = seed.coachKey ? coachIdResolver(seed.coachKey) : null;
    row.scheduledStart = seed.scheduledStart;
    row.scheduledEnd = seed.scheduledEnd;
    row.location = seed.location;
    row.status = seed.status;
    row.notes = seed.notes;
    await sessions.save(row);
  }
  return ids;
}

async function ensureExpansionAttendance(
  club: ExpansionClub,
  records: ExpansionAttendance[],
  attendance: Repository<Attendance>,
  sessionIds: Map<string, string>,
  athleteIds: Map<string, string>,
): Promise<void> {
  for (const seed of records) {
    const sessionId = sessionIds.get(seed.sessionKey);
    const athleteId = athleteIds.get(seed.athleteKey);
    if (!sessionId || !athleteId) continue;
    const id = stableId(club.tenantSlug, 'expansion-attendance', seed.sessionKey, seed.athleteKey);
    const row =
      (await attendance.findOne({ where: { id } })) ??
      attendance.create({
        id,
        tenantId: club.tenantId,
        trainingSessionId: sessionId,
        athleteId,
      });
    row.status = seed.status;
    row.note = seed.note;
    row.recordedAt = new Date();
    await attendance.save(row);
  }
}

async function ensureExpansionChargeItems(
  club: ExpansionClub,
  chargeItems: Repository<ChargeItem>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of club.chargeItems) {
    const id = stableId(club.tenantSlug, 'expansion-charge-item', seed.key);
    ids.set(seed.key, id);
    const row =
      (await chargeItems.findOne({ where: { id } })) ??
      chargeItems.create({ id, tenantId: club.tenantId });
    row.name = seed.name;
    row.category = seed.category;
    row.defaultAmount = seed.defaultAmount;
    row.currency = seed.currency;
    row.isActive = true;
    await chargeItems.save(row);
  }
  return ids;
}

async function ensureExpansionPrivateLessons(
  club: ExpansionClub,
  privateLessons: Repository<PrivateLesson>,
  branchId: string,
  athleteIds: Map<string, string>,
  coachIdResolver: (key: string) => string,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of club.privateLessons) {
    const id = stableId(club.tenantSlug, 'expansion-private-lesson', seed.key);
    ids.set(seed.key, id);
    const athleteId = athleteIds.get(seed.athleteKey);
    if (!athleteId) continue;
    const coachId = coachIdResolver(seed.coachKey);
    const row =
      (await privateLessons.findOne({ where: { id } })) ??
      privateLessons.create({
        id,
        tenantId: club.tenantId,
        athleteId,
        coachId,
        sportBranchId: branchId,
      });
    row.focus = seed.focus;
    row.scheduledStart = seed.scheduledStart;
    row.scheduledEnd = seed.scheduledEnd;
    row.location = seed.location;
    row.status = seed.status;
    row.attendanceStatus = seed.attendanceStatus;
    row.notes = seed.notes;
    await privateLessons.save(row);
  }
  return ids;
}

async function ensureExpansionCharges(
  club: ExpansionClub,
  records: ExpansionAthleteCharge[],
  athleteCharges: Repository<AthleteCharge>,
  athleteIds: Map<string, string>,
  chargeItemIds: Map<string, string>,
  baseChargeItemIds: Map<string, string>,
  privateLessonIds: Map<string, string>,
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const seed of records) {
    const id = stableId(club.tenantSlug, 'expansion-athlete-charge', seed.key);
    ids.set(seed.key, id);
    const athleteId = athleteIds.get(seed.athleteKey);
    if (!athleteId) continue;
    const chargeItemId =
      chargeItemIds.get(seed.chargeItemKey) ??
      baseChargeItemIds.get(seed.chargeItemKey) ??
      null;
    if (!chargeItemId) continue;
    const row =
      (await athleteCharges.findOne({ where: { id } })) ??
      athleteCharges.create({
        id,
        tenantId: club.tenantId,
        athleteId,
        chargeItemId,
      });
    row.amount = seed.amount;
    row.dueDate = seed.dueDate;
    row.status = seed.status;
    row.notes = seed.notes;
    row.privateLessonId = seed.privateLessonKey ? privateLessonIds.get(seed.privateLessonKey) ?? null : null;
    row.billingPeriodKey = seed.billingPeriodKey ?? null;
    row.billingPeriodLabel = seed.billingPeriodLabel ?? null;
    await athleteCharges.save(row);
  }
  return ids;
}

async function ensureExpansionPayments(
  club: ExpansionClub,
  records: ExpansionPayment[],
  payments: Repository<Payment>,
  paymentAllocations: Repository<PaymentAllocation>,
  athleteIds: Map<string, string>,
  chargeIds: Map<string, string>,
): Promise<void> {
  for (const seed of records) {
    const id = stableId(club.tenantSlug, 'expansion-payment', seed.key);
    const athleteId = athleteIds.get(seed.athleteKey);
    if (!athleteId) continue;
    const row =
      (await payments.findOne({ where: { id } })) ??
      payments.create({
        id,
        tenantId: club.tenantId,
        athleteId,
      });
    row.amount = seed.amount;
    row.currency = seed.currency;
    row.paidAt = seed.paidAt;
    row.method = seed.method;
    row.reference = seed.reference;
    row.notes = seed.notes;
    await payments.save(row);

    for (const allocation of seed.allocations) {
      const chargeId = chargeIds.get(allocation.chargeKey);
      if (!chargeId) continue;
      const allocationId = stableId(club.tenantSlug, 'expansion-allocation', seed.key, allocation.chargeKey);
      const allocationRow =
        (await paymentAllocations.findOne({ where: { id: allocationId } })) ??
        paymentAllocations.create({
          id: allocationId,
          tenantId: club.tenantId,
          paymentId: id,
          athleteChargeId: chargeId,
        });
      allocationRow.amount = allocation.amount;
      await paymentAllocations.save(allocationRow);
    }
  }
}

async function loadBaseAgeGroupIds(
  club: ExpansionClub,
  ageGroups: Repository<AgeGroup>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  // Base seed uses keys like 'u12', 'u13', 'u14', 'u15', 'u16'. We mirror them so
  // the expansion 'u16' age group reuses the base id when it already exists.
  const knownKeys = ['u8', 'u9', 'u10', 'u11', 'u12', 'u13', 'u14', 'u15', 'u16', 'u17', 'u18'];
  for (const key of knownKeys) {
    const id = stableId(club.tenantSlug, 'age', key);
    const row = await ageGroups.findOne({ where: { id } });
    if (row) {
      map.set(key, id);
    }
  }
  return map;
}

async function loadBaseChargeItemIds(
  club: ExpansionClub,
  chargeItems: Repository<ChargeItem>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const knownKeys = ['dues', 'camp', 'sweatshirt', 'tournament', 'private-lesson', 'kit', 'jersey'];
  for (const key of knownKeys) {
    const id = stableId(club.tenantSlug, 'charge-item', key);
    const row = await chargeItems.findOne({ where: { id } });
    if (row) {
      map.set(key, id);
    }
  }
  return map;
}

async function loadBranchId(
  club: ExpansionClub,
  branches: Repository<SportBranch>,
): Promise<string | null> {
  const branchKey = CLUB_BASE_BRANCH_KEY[club.tenantSlug];
  if (!branchKey) return null;
  const id = stableId(club.tenantSlug, 'branch', branchKey);
  const row = await branches.findOne({ where: { id } });
  return row?.id ?? null;
}

async function ensureExpansionOutreachActivities(
  club: ExpansionClub,
  outreachActivities: Repository<OutreachActivity>,
  athleteIds: Map<string, string>,
): Promise<void> {
  const samples = [
    {
      key: 'overdue-may',
      channel: 'whatsapp',
      sourceSurface: 'finance_overdue',
      sourceKey: null,
      templateKey: 'overdue_payment_reminder',
      topic: 'Overdue payment — May dues',
      messagePreview:
        'Hello,\n\nA gentle reminder about an outstanding May balance for {{athleteName}}. Reply on WhatsApp anytime.',
      recipientCount: 6,
      reachableGuardianCount: 5,
      contextLabel: 'Finance · Overdue balance',
      ageDays: 9,
    },
    {
      key: 'attendance-quiet',
      channel: 'whatsapp',
      sourceSurface: 'attendance_quiet',
      sourceKey: null,
      templateKey: 'attendance_check_in',
      topic: 'Just checking in — quiet week',
      messagePreview:
        'Hello,\n\nWe noticed {{athleteName}} hasn’t been at training for a couple of weeks. Just checking in.',
      recipientCount: 3,
      reachableGuardianCount: 3,
      contextLabel: 'Attendance · Quiet lately',
      ageDays: 4,
    },
    {
      key: 'trial-warmth',
      channel: 'whatsapp',
      sourceSurface: 'trial_high_engagement',
      sourceKey: null,
      templateKey: 'trial_warm_follow_up',
      topic: 'Trial follow-up — warm leads',
      messagePreview:
        'Hello,\n\nWe loved having {{athleteName}} at the trial sessions. Would you like to chat about the next step?',
      recipientCount: 2,
      reachableGuardianCount: 2,
      contextLabel: 'Trial · High engagement',
      ageDays: 2,
    },
  ];

  const knownAthleteIds = Array.from(athleteIds.values()).slice(0, 8);
  if (knownAthleteIds.length === 0) return;
  const now = Date.now();
  for (const sample of samples) {
    const id = stableId(club.tenantSlug, 'outreach-activity', sample.key);
    const existing = await outreachActivities.findOne({ where: { id } });
    const audienceSnapshot = {
      athleteIds: knownAthleteIds.slice(0, sample.recipientCount),
      guardianIds: [],
      audienceSummary: {
        athletes: sample.recipientCount,
        guardians: sample.reachableGuardianCount,
        primaryContacts: sample.reachableGuardianCount,
        contextLabel: sample.contextLabel,
      },
    };
    const row =
      existing ??
      outreachActivities.create({
        id,
        tenantId: club.tenantId,
      });
    row.tenantId = club.tenantId;
    row.channel = sample.channel;
    row.sourceSurface = sample.sourceSurface;
    row.sourceKey = sample.sourceKey;
    row.templateKey = sample.templateKey;
    row.topic = sample.topic;
    row.messagePreview = sample.messagePreview;
    row.recipientCount = sample.recipientCount;
    row.reachableGuardianCount = sample.reachableGuardianCount;
    row.audienceSnapshot = audienceSnapshot;
    row.note = null;
    row.createdByStaffUserId = null;
    if (!existing) {
      row.createdAt = new Date(now - sample.ageDays * 24 * 60 * 60 * 1000);
      row.updatedAt = row.createdAt;
    }
    await outreachActivities.save(row);
  }
}

export async function runDemoSeedExpansion(dataSource: DataSource): Promise<void> {
  const tenants = dataSource.getRepository(Tenant);

  await dataSource.transaction(async (manager) => {
    const ageGroups = manager.getRepository(AgeGroup);
    const groups = manager.getRepository(ClubGroup);
    const teams = manager.getRepository(Team);
    const coaches = manager.getRepository(Coach);
    const branches = manager.getRepository(SportBranch);
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
    const portalAccesses = manager.getRepository(GuardianPortalAccess);
    const outreachActivities = manager.getRepository(OutreachActivity);
    const tenantsLocal = manager.getRepository(Tenant);

    const clubConfigs = buildClubExpansionConfig();

    for (const club of clubConfigs) {
      const tenantRow = await tenantsLocal.findOne({ where: { id: club.tenantId } });
      if (!tenantRow) {
        // The base seed must run first; if the tenant is missing we skip this
        // expansion rather than create a duplicate tenant out of order.
        continue;
      }

      const branchId = await loadBranchId(club, branches);
      if (!branchId) {
        continue;
      }

      const baseAgeGroupIds = await loadBaseAgeGroupIds(club, ageGroups);
      const baseChargeItemIds = await loadBaseChargeItemIds(club, chargeItems);

      const expansionAgeGroupIds = await ensureExpansionAgeGroups(club, ageGroups);

      const baseCoachIds = new Map<string, string>();
      const expansionCoachIds = await ensureExpansionCoaches(club, coaches, branchId);
      const coachIdResolver = (key: string): string => {
        const expansionId = expansionCoachIds.get(key);
        if (expansionId) return expansionId;
        const baseId = baseCoachIds.get(key);
        if (baseId) return baseId;
        // Default to first expansion coach to avoid null head_coach references.
        return Array.from(expansionCoachIds.values())[0];
      };
      const coachIdResolverNullable = (key: string): string | null => {
        const expansionId = expansionCoachIds.get(key);
        if (expansionId) return expansionId;
        const baseId = baseCoachIds.get(key);
        return baseId ?? null;
      };

      const groupIds = await ensureExpansionGroups(
        club,
        groups,
        branchId,
        baseAgeGroupIds,
        expansionAgeGroupIds,
        coachIdResolver,
      );
      const teamIds = await ensureExpansionTeams(club, teams, branchId, groupIds, coachIdResolver);

      const teamsByGroup = new Map<string, string[]>();
      for (const team of club.teams) {
        const list = teamsByGroup.get(team.groupKey) ?? [];
        list.push(team.key);
        teamsByGroup.set(team.groupKey, list);
      }

      const guardiansList = generateGuardians(club);
      const guardianIds = await ensureExpansionGuardians(club, guardiansList, guardians);
      await ensureExpansionPortalAccess(club, guardiansList, guardianIds, portalAccesses);

      const ageGroupConfig = new Map<string, ExpansionAgeGroup>();
      for (const ag of club.ageGroups) {
        ageGroupConfig.set(ag.key, ag);
      }

      const groupKeys = club.groups.map((g) => g.key);
      const athleteList = generateAthletes(
        club,
        ageGroupConfig,
        groupKeys,
        teamsByGroup,
        guardiansList,
      );
      const athleteIds = await ensureExpansionAthletes(
        club,
        athleteList,
        athletes,
        athleteGuardians,
        guardianIds,
        branchId,
        groupIds,
        teamIds,
        memberships,
      );

      const sessionList = generateRecurringSessions(club);
      const sessionIds = await ensureExpansionTrainingSessions(
        club,
        sessionList,
        sessions,
        branchId,
        groupIds,
        teamIds,
        coachIdResolverNullable,
      );

      const attendanceList = generateAttendance(club, sessionList, athleteList);
      await ensureExpansionAttendance(club, attendanceList, attendances, sessionIds, athleteIds);

      const expansionChargeItemIds = await ensureExpansionChargeItems(club, chargeItems);
      const privateLessonIds = await ensureExpansionPrivateLessons(
        club,
        privateLessons,
        branchId,
        athleteIds,
        coachIdResolver,
      );

      const allChargeItemConfigs = club.chargeItems.slice();
      // Surface dues / merch / tournament / camp items if present in base seed for charge generation.
      if (!allChargeItemConfigs.some((item) => item.category === 'dues')) {
        const baseDuesId = baseChargeItemIds.get('dues');
        if (baseDuesId) {
          allChargeItemConfigs.push({ key: 'dues', name: 'Monthly dues', category: 'dues', defaultAmount: '850.00', currency: 'TRY' });
        }
      }
      if (!allChargeItemConfigs.some((item) => item.category === 'merchandise')) {
        const baseMerchKey = baseChargeItemIds.has('sweatshirt') ? 'sweatshirt' : baseChargeItemIds.has('kit') ? 'kit' : baseChargeItemIds.has('jersey') ? 'jersey' : null;
        if (baseMerchKey) {
          allChargeItemConfigs.push({ key: baseMerchKey, name: 'Merchandise', category: 'merchandise', defaultAmount: '1200.00', currency: 'TRY' });
        }
      }
      if (!allChargeItemConfigs.some((item) => item.category === 'tournament')) {
        if (baseChargeItemIds.has('tournament')) {
          allChargeItemConfigs.push({ key: 'tournament', name: 'Tournament', category: 'tournament', defaultAmount: '1800.00', currency: 'TRY' });
        }
      }
      if (!allChargeItemConfigs.some((item) => item.category === 'camp')) {
        if (baseChargeItemIds.has('camp')) {
          allChargeItemConfigs.push({ key: 'camp', name: 'Camp', category: 'camp', defaultAmount: '3500.00', currency: 'TRY' });
        }
      }

      const { charges: chargeRecords, payments: paymentRecords } = generateCharges(
        club,
        athleteList,
        allChargeItemConfigs,
      );
      const chargeIds = await ensureExpansionCharges(
        club,
        chargeRecords,
        athleteCharges,
        athleteIds,
        expansionChargeItemIds,
        baseChargeItemIds,
        privateLessonIds,
      );
      await ensureExpansionPayments(
        club,
        paymentRecords,
        payments,
        paymentAllocations,
        athleteIds,
        chargeIds,
      );

      await ensureExpansionOutreachActivities(club, outreachActivities, athleteIds);
    }
  });

  // Touch the tenants table so an explicit transaction commit boundary exists.
  await tenants.find();
}
