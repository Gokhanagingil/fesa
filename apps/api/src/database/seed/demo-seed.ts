import { DataSource } from 'typeorm';
import {
  Tenant,
  SportBranch,
  AgeGroup,
  ClubGroup,
  Team,
  Guardian,
  Athlete,
  AthleteGuardian,
  AthleteTeamMembership,
  TrainingSession,
  Attendance,
  ChargeItem,
  AthleteCharge,
} from '../entities';
import {
  DEMO_TENANT_ID,
  DEMO_TENANT_NAME,
  DEMO_TENANT_SLUG,
  BRANCH_BASKETBALL_ID,
  BRANCH_VOLLEYBALL_ID,
  BRANCH_FOOTBALL_ID,
  AGE_U12_ID,
  AGE_U14_ID,
  AGE_U16_ID,
  GROUP_BB_U12_ID,
  GROUP_BB_U14_ID,
  GROUP_VB_U14_ID,
  GROUP_FB_U16_ID,
  TEAM_BB_U12_A_ID,
  TEAM_BB_U14_A_ID,
  GUARDIAN_AYSE_ID,
  GUARDIAN_MURAT_ID,
  GUARDIAN_ELIF_ID,
  ATHLETE_EFE_ID,
  ATHLETE_DENIZ_ID,
  ATHLETE_ZEYNEP_ID,
  ATHLETE_CEM_ID,
  ATHLETE_SELIN_ID,
  ATHLETE_DEFNE_ID,
  ATHLETE_KEREM_ID,
  ATHLETE_BURAK_ID,
  CHARGE_DUES_ID,
  CHARGE_CAMP_ID,
  CHARGE_SWEATSHIRT_ID,
  CHARGE_TOURNAMENT_ID,
  SESSION_BB_U12_GROUP_ID,
  SESSION_BB_U12_TEAM_ID,
  SESSION_VB_U14_ID,
  SESSION_FB_U16_ID,
  SESSION_BB_U12_PLANNED_ID,
  SESSION_BB_U14_GROUP_ID,
  AC_EFE_DUES_ID,
  AC_EFE_CAMP_ID,
  AC_DENIZ_DUES_ID,
  AC_DENIZ_SHIRT_ID,
  AC_ZEYNEP_TOUR_ID,
  AC_SELIN_DUES_ID,
  AC_KEREM_CAMP_ID,
  AC_BURAK_DUES_ID,
} from './constants';
import {
  AthleteStatus,
  AthleteChargeStatus,
  AttendanceStatus,
  TrainingSessionStatus,
} from '../enums';

function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
}

/**
 * Idempotent demo dataset for local dev and staging: one amateur club tenant,
 * branches, cohorts, teams, athletes (group-only vs group+team), training + attendance, finance rows.
 */
export async function runDemoSeed(dataSource: DataSource): Promise<void> {
  await dataSource.transaction(async (manager) => {
    const tenants = manager.getRepository(Tenant);
    const branches = manager.getRepository(SportBranch);
    const ageGroups = manager.getRepository(AgeGroup);
    const groups = manager.getRepository(ClubGroup);
    const teams = manager.getRepository(Team);
    const guardians = manager.getRepository(Guardian);
    const athletes = manager.getRepository(Athlete);
    const athleteGuardians = manager.getRepository(AthleteGuardian);
    const memberships = manager.getRepository(AthleteTeamMembership);
    const sessions = manager.getRepository(TrainingSession);
    const attendances = manager.getRepository(Attendance);
    const chargeItems = manager.getRepository(ChargeItem);
    const athleteCharges = manager.getRepository(AthleteCharge);

    await tenants.save({
      id: DEMO_TENANT_ID,
      name: DEMO_TENANT_NAME,
      slug: DEMO_TENANT_SLUG,
    });

    await branches.save([
      {
        id: BRANCH_BASKETBALL_ID,
        tenantId: DEMO_TENANT_ID,
        code: 'BASKETBALL',
        name: 'Basketball',
      },
      {
        id: BRANCH_VOLLEYBALL_ID,
        tenantId: DEMO_TENANT_ID,
        code: 'VOLLEYBALL',
        name: 'Volleyball',
      },
      {
        id: BRANCH_FOOTBALL_ID,
        tenantId: DEMO_TENANT_ID,
        code: 'FOOTBALL',
        name: 'Football',
      },
    ]);

    await ageGroups.save([
      {
        id: AGE_U12_ID,
        tenantId: DEMO_TENANT_ID,
        label: 'U12',
        birthYearFrom: 2013,
        birthYearTo: 2014,
      },
      {
        id: AGE_U14_ID,
        tenantId: DEMO_TENANT_ID,
        label: 'U14',
        birthYearFrom: 2011,
        birthYearTo: 2012,
      },
      {
        id: AGE_U16_ID,
        tenantId: DEMO_TENANT_ID,
        label: 'U16',
        birthYearFrom: 2009,
        birthYearTo: 2010,
      },
    ]);

    await groups.save([
      {
        id: GROUP_BB_U12_ID,
        tenantId: DEMO_TENANT_ID,
        sportBranchId: BRANCH_BASKETBALL_ID,
        ageGroupId: AGE_U12_ID,
        name: 'Basketball · U12 cohort',
      },
      {
        id: GROUP_BB_U14_ID,
        tenantId: DEMO_TENANT_ID,
        sportBranchId: BRANCH_BASKETBALL_ID,
        ageGroupId: AGE_U14_ID,
        name: 'Basketball · U14 cohort',
      },
      {
        id: GROUP_VB_U14_ID,
        tenantId: DEMO_TENANT_ID,
        sportBranchId: BRANCH_VOLLEYBALL_ID,
        ageGroupId: AGE_U14_ID,
        name: 'Volleyball · U14 cohort',
      },
      {
        id: GROUP_FB_U16_ID,
        tenantId: DEMO_TENANT_ID,
        sportBranchId: BRANCH_FOOTBALL_ID,
        ageGroupId: AGE_U16_ID,
        name: 'Football · U16 cohort',
      },
    ]);

    await teams.save([
      {
        id: TEAM_BB_U12_A_ID,
        tenantId: DEMO_TENANT_ID,
        sportBranchId: BRANCH_BASKETBALL_ID,
        groupId: GROUP_BB_U12_ID,
        name: 'U12 A (Mini)',
        code: 'BB-U12-A',
      },
      {
        id: TEAM_BB_U14_A_ID,
        tenantId: DEMO_TENANT_ID,
        sportBranchId: BRANCH_BASKETBALL_ID,
        groupId: GROUP_BB_U14_ID,
        name: 'U14 A',
        code: 'BB-U14-A',
      },
    ]);

    await guardians.save([
      {
        id: GUARDIAN_AYSE_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        phone: '+90 532 111 2233',
        email: 'ayse.yilmaz@example.com',
        notes: null,
      },
      {
        id: GUARDIAN_MURAT_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Murat',
        lastName: 'Kaya',
        phone: '+90 533 444 5566',
        email: 'murat.kaya@example.com',
        notes: null,
      },
      {
        id: GUARDIAN_ELIF_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Elif',
        lastName: 'Demir',
        phone: '+90 534 777 8899',
        email: 'elif.demir@example.com',
        notes: null,
      },
    ]);

    await athletes.save([
      {
        id: ATHLETE_EFE_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Efe',
        lastName: 'Arslan',
        preferredName: null,
        birthDate: d(2013, 4, 12),
        gender: 'male',
        sportBranchId: BRANCH_BASKETBALL_ID,
        primaryGroupId: GROUP_BB_U12_ID,
        status: AthleteStatus.ACTIVE,
        jerseyNumber: '7',
        notes: 'Group + team: plays U12 A',
      },
      {
        id: ATHLETE_DENIZ_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Deniz',
        lastName: 'Öztürk',
        preferredName: null,
        birthDate: d(2013, 8, 3),
        gender: 'female',
        sportBranchId: BRANCH_BASKETBALL_ID,
        primaryGroupId: GROUP_BB_U12_ID,
        status: AthleteStatus.ACTIVE,
        jerseyNumber: '11',
        notes: 'Group-only: academy training, no competitive team yet',
      },
      {
        id: ATHLETE_ZEYNEP_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Zeynep',
        lastName: 'Çelik',
        preferredName: null,
        birthDate: d(2011, 2, 19),
        gender: 'female',
        sportBranchId: BRANCH_BASKETBALL_ID,
        primaryGroupId: GROUP_BB_U14_ID,
        status: AthleteStatus.ACTIVE,
        jerseyNumber: '5',
        notes: 'Group + team: U14 A roster',
      },
      {
        id: ATHLETE_CEM_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Cem',
        lastName: 'Şahin',
        preferredName: null,
        birthDate: d(2011, 11, 7),
        gender: 'male',
        sportBranchId: BRANCH_BASKETBALL_ID,
        primaryGroupId: GROUP_BB_U14_ID,
        status: AthleteStatus.TRIAL,
        jerseyNumber: null,
        notes: 'Trial period — evaluating fit for U14 cohort',
      },
      {
        id: ATHLETE_SELIN_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Selin',
        lastName: 'Aydın',
        preferredName: null,
        birthDate: d(2012, 1, 25),
        gender: 'female',
        sportBranchId: BRANCH_VOLLEYBALL_ID,
        primaryGroupId: GROUP_VB_U14_ID,
        status: AthleteStatus.ACTIVE,
        jerseyNumber: '9',
        notes: 'Volleyball — group training only this season',
      },
      {
        id: ATHLETE_DEFNE_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Defne',
        lastName: 'Koç',
        preferredName: null,
        birthDate: d(2012, 6, 14),
        gender: 'female',
        sportBranchId: BRANCH_VOLLEYBALL_ID,
        primaryGroupId: GROUP_VB_U14_ID,
        status: AthleteStatus.ACTIVE,
        jerseyNumber: '3',
        notes: null,
      },
      {
        id: ATHLETE_KEREM_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Kerem',
        lastName: 'Yıldız',
        preferredName: null,
        birthDate: d(2009, 9, 30),
        gender: 'male',
        sportBranchId: BRANCH_FOOTBALL_ID,
        primaryGroupId: GROUP_FB_U16_ID,
        status: AthleteStatus.ACTIVE,
        jerseyNumber: '10',
        notes: 'Football academy — group sessions',
      },
      {
        id: ATHLETE_BURAK_ID,
        tenantId: DEMO_TENANT_ID,
        firstName: 'Burak',
        lastName: 'Erdoğan',
        preferredName: null,
        birthDate: d(2010, 3, 8),
        gender: 'male',
        sportBranchId: BRANCH_FOOTBALL_ID,
        primaryGroupId: GROUP_FB_U16_ID,
        status: AthleteStatus.INACTIVE,
        jerseyNumber: null,
        notes: 'Paused — family travel; keep on roster for reactivation',
      },
    ]);

    const link = async (athleteId: string, guardianId: string, relationshipType: string, isPrimary: boolean) => {
      const existing = await athleteGuardians.findOne({ where: { athleteId, guardianId } });
      const row = existing ?? athleteGuardians.create({ tenantId: DEMO_TENANT_ID, athleteId, guardianId });
      row.relationshipType = relationshipType;
      row.isPrimaryContact = isPrimary;
      row.notes = null;
      await athleteGuardians.save(row);
    };

    await link(ATHLETE_EFE_ID, GUARDIAN_AYSE_ID, 'mother', true);
    await link(ATHLETE_DENIZ_ID, GUARDIAN_AYSE_ID, 'mother', true);
    await link(ATHLETE_ZEYNEP_ID, GUARDIAN_MURAT_ID, 'father', true);
    await link(ATHLETE_CEM_ID, GUARDIAN_MURAT_ID, 'father', true);
    await link(ATHLETE_SELIN_ID, GUARDIAN_ELIF_ID, 'mother', true);
    await link(ATHLETE_DEFNE_ID, GUARDIAN_ELIF_ID, 'mother', false);
    await link(ATHLETE_KEREM_ID, GUARDIAN_AYSE_ID, 'guardian', true);
    await link(ATHLETE_BURAK_ID, GUARDIAN_MURAT_ID, 'father', true);

    const ensureMembership = async (athleteId: string, teamId: string) => {
      let m = await memberships.findOne({
        where: { tenantId: DEMO_TENANT_ID, athleteId, teamId },
      });
      if (!m) {
        m = memberships.create({
          tenantId: DEMO_TENANT_ID,
          athleteId,
          teamId,
          startedAt: new Date('2025-09-01T00:00:00.000Z'),
          endedAt: null,
        });
      } else {
        m.startedAt = new Date('2025-09-01T00:00:00.000Z');
        m.endedAt = null;
      }
      await memberships.save(m);
    };

    await ensureMembership(ATHLETE_EFE_ID, TEAM_BB_U12_A_ID);
    await ensureMembership(ATHLETE_ZEYNEP_ID, TEAM_BB_U14_A_ID);
    // Deniz, Selin, Kerem: intentionally no team membership (group-only scenarios)

    const base = new Date();
    const monThisWeek = new Date(base);
    monThisWeek.setUTCDate(base.getUTCDate() - ((base.getUTCDay() + 6) % 7));
    monThisWeek.setUTCHours(0, 0, 0, 0);
    const tue = new Date(monThisWeek);
    tue.setUTCDate(monThisWeek.getUTCDate() + 1);
    const wed = new Date(monThisWeek);
    wed.setUTCDate(monThisWeek.getUTCDate() + 2);
    const thu = new Date(monThisWeek);
    thu.setUTCDate(monThisWeek.getUTCDate() + 3);
    const nextMon = new Date(monThisWeek);
    nextMon.setUTCDate(monThisWeek.getUTCDate() + 7);

    await sessions.save([
      {
        id: SESSION_BB_U12_GROUP_ID,
        tenantId: DEMO_TENANT_ID,
        title: 'U12 — Skills & fundamentals',
        sportBranchId: BRANCH_BASKETBALL_ID,
        groupId: GROUP_BB_U12_ID,
        teamId: null,
        scheduledStart: new Date(tue.getTime() + 15 * 60 * 60 * 1000),
        scheduledEnd: new Date(tue.getTime() + 16.5 * 60 * 60 * 1000),
        location: 'Caferağa Sports Hall — Court 2',
        status: TrainingSessionStatus.COMPLETED,
        notes: 'Ball handling and defensive slides',
      },
      {
        id: SESSION_BB_U12_TEAM_ID,
        tenantId: DEMO_TENANT_ID,
        title: 'U12 A — Team practice',
        sportBranchId: BRANCH_BASKETBALL_ID,
        groupId: GROUP_BB_U12_ID,
        teamId: TEAM_BB_U12_A_ID,
        scheduledStart: new Date(thu.getTime() + 16 * 60 * 60 * 1000),
        scheduledEnd: new Date(thu.getTime() + 17.25 * 60 * 60 * 1000),
        location: 'Caferağa Sports Hall — Court 1',
        status: TrainingSessionStatus.COMPLETED,
        notes: 'Set plays and inbound series',
      },
      {
        id: SESSION_BB_U14_GROUP_ID,
        tenantId: DEMO_TENANT_ID,
        title: 'U14 — Shooting clinic',
        sportBranchId: BRANCH_BASKETBALL_ID,
        groupId: GROUP_BB_U14_ID,
        teamId: null,
        scheduledStart: new Date(wed.getTime() + 17 * 60 * 60 * 1000),
        scheduledEnd: new Date(wed.getTime() + 18.25 * 60 * 60 * 1000),
        location: 'Caferağa Sports Hall — Court 2',
        status: TrainingSessionStatus.COMPLETED,
        notes: null,
      },
      {
        id: SESSION_VB_U14_ID,
        tenantId: DEMO_TENANT_ID,
        title: 'U14 Volleyball — Reception block',
        sportBranchId: BRANCH_VOLLEYBALL_ID,
        groupId: GROUP_VB_U14_ID,
        teamId: null,
        scheduledStart: new Date(monThisWeek.getTime() + 18 * 60 * 60 * 1000),
        scheduledEnd: new Date(monThisWeek.getTime() + 19.5 * 60 * 60 * 1000),
        location: 'Kadıköy Volleyball Annex',
        status: TrainingSessionStatus.COMPLETED,
        notes: 'Serve receive patterns',
      },
      {
        id: SESSION_FB_U16_ID,
        tenantId: DEMO_TENANT_ID,
        title: 'U16 Football — Small-sided games',
        sportBranchId: BRANCH_FOOTBALL_ID,
        groupId: GROUP_FB_U16_ID,
        teamId: null,
        scheduledStart: new Date(wed.getTime() + 18.5 * 60 * 60 * 1000),
        scheduledEnd: new Date(wed.getTime() + 20 * 60 * 60 * 1000),
        location: 'Moda grass pitch',
        status: TrainingSessionStatus.COMPLETED,
        notes: 'Pressing triggers and rest defense',
      },
      {
        id: SESSION_BB_U12_PLANNED_ID,
        tenantId: DEMO_TENANT_ID,
        title: 'U12 — Weekend scrimmage (planned)',
        sportBranchId: BRANCH_BASKETBALL_ID,
        groupId: GROUP_BB_U12_ID,
        teamId: null,
        scheduledStart: new Date(nextMon.getTime() + 10 * 60 * 60 * 1000),
        scheduledEnd: new Date(nextMon.getTime() + 11.5 * 60 * 60 * 1000),
        location: 'Caferağa Sports Hall — Court 2',
        status: TrainingSessionStatus.PLANNED,
        notes: 'Internal scrimmage — invite parents',
      },
    ]);

    await chargeItems.save([
      {
        id: CHARGE_DUES_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Monthly membership dues',
        category: 'dues',
        defaultAmount: '850.00',
        currency: 'TRY',
        isActive: true,
      },
      {
        id: CHARGE_CAMP_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Winter skills camp',
        category: 'camp',
        defaultAmount: '3500.00',
        currency: 'TRY',
        isActive: true,
      },
      {
        id: CHARGE_SWEATSHIRT_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Club sweatshirt',
        category: 'merchandise',
        defaultAmount: '1200.00',
        currency: 'TRY',
        isActive: true,
      },
      {
        id: CHARGE_TOURNAMENT_ID,
        tenantId: DEMO_TENANT_ID,
        name: 'Regional tournament entry',
        category: 'tournament',
        defaultAmount: '1800.00',
        currency: 'TRY',
        isActive: true,
      },
    ]);

    await athleteCharges.save([
      {
        id: AC_EFE_DUES_ID,
        tenantId: DEMO_TENANT_ID,
        athleteId: ATHLETE_EFE_ID,
        chargeItemId: CHARGE_DUES_ID,
        amount: '850.00',
        dueDate: d(2026, 4, 1),
        status: AthleteChargeStatus.PAID,
        notes: null,
      },
      {
        id: AC_EFE_CAMP_ID,
        tenantId: DEMO_TENANT_ID,
        athleteId: ATHLETE_EFE_ID,
        chargeItemId: CHARGE_CAMP_ID,
        amount: '3500.00',
        dueDate: d(2026, 5, 15),
        status: AthleteChargeStatus.PARTIALLY_PAID,
        notes: 'Deposit received',
      },
      {
        id: AC_DENIZ_DUES_ID,
        tenantId: DEMO_TENANT_ID,
        athleteId: ATHLETE_DENIZ_ID,
        chargeItemId: CHARGE_DUES_ID,
        amount: '850.00',
        dueDate: d(2026, 4, 1),
        status: AthleteChargeStatus.PENDING,
        notes: null,
      },
      {
        id: AC_DENIZ_SHIRT_ID,
        tenantId: DEMO_TENANT_ID,
        athleteId: ATHLETE_DENIZ_ID,
        chargeItemId: CHARGE_SWEATSHIRT_ID,
        amount: '1200.00',
        dueDate: d(2026, 4, 20),
        status: AthleteChargeStatus.PENDING,
        notes: null,
      },
      {
        id: AC_ZEYNEP_TOUR_ID,
        tenantId: DEMO_TENANT_ID,
        athleteId: ATHLETE_ZEYNEP_ID,
        chargeItemId: CHARGE_TOURNAMENT_ID,
        amount: '1800.00',
        dueDate: d(2026, 6, 1),
        status: AthleteChargeStatus.PENDING,
        notes: null,
      },
      {
        id: AC_SELIN_DUES_ID,
        tenantId: DEMO_TENANT_ID,
        athleteId: ATHLETE_SELIN_ID,
        chargeItemId: CHARGE_DUES_ID,
        amount: '850.00',
        dueDate: d(2026, 3, 1),
        status: AthleteChargeStatus.PAID,
        notes: null,
      },
      {
        id: AC_KEREM_CAMP_ID,
        tenantId: DEMO_TENANT_ID,
        athleteId: ATHLETE_KEREM_ID,
        chargeItemId: CHARGE_CAMP_ID,
        amount: '3500.00',
        dueDate: d(2026, 1, 10),
        status: AthleteChargeStatus.CANCELLED,
        notes: 'Cancelled — switched to spring camp',
      },
      {
        id: AC_BURAK_DUES_ID,
        tenantId: DEMO_TENANT_ID,
        athleteId: ATHLETE_BURAK_ID,
        chargeItemId: CHARGE_DUES_ID,
        amount: '850.00',
        dueDate: d(2026, 2, 1),
        status: AthleteChargeStatus.PARTIALLY_PAID,
        notes: 'Paused membership',
      },
    ]);

    const upsertAttendance = async (
      trainingSessionId: string,
      athleteId: string,
      status: AttendanceStatus,
      note: string | null,
    ) => {
      let row = await attendances.findOne({ where: { trainingSessionId, athleteId } });
      if (!row) {
        row = attendances.create({
          tenantId: DEMO_TENANT_ID,
          trainingSessionId,
          athleteId,
          status,
          note,
          recordedAt: new Date(),
        });
      } else {
        row.status = status;
        row.note = note;
        row.recordedAt = new Date();
      }
      await attendances.save(row);
    };

    // U12 group session — both cohort athletes
    await upsertAttendance(SESSION_BB_U12_GROUP_ID, ATHLETE_EFE_ID, AttendanceStatus.PRESENT, null);
    await upsertAttendance(SESSION_BB_U12_GROUP_ID, ATHLETE_DENIZ_ID, AttendanceStatus.LATE, 'Traffic on bridge');

    // U12 team session — only rostered team members eligible in API; Efe is on team, Deniz is not
    await upsertAttendance(SESSION_BB_U12_TEAM_ID, ATHLETE_EFE_ID, AttendanceStatus.PRESENT, null);

    // U14 basketball group
    await upsertAttendance(SESSION_BB_U14_GROUP_ID, ATHLETE_ZEYNEP_ID, AttendanceStatus.PRESENT, null);
    await upsertAttendance(SESSION_BB_U14_GROUP_ID, ATHLETE_CEM_ID, AttendanceStatus.EXCUSED, 'School exam');

    // Volleyball
    await upsertAttendance(SESSION_VB_U14_ID, ATHLETE_SELIN_ID, AttendanceStatus.PRESENT, null);
    await upsertAttendance(SESSION_VB_U14_ID, ATHLETE_DEFNE_ID, AttendanceStatus.ABSENT, 'No show');

    // Football
    await upsertAttendance(SESSION_FB_U16_ID, ATHLETE_KEREM_ID, AttendanceStatus.PRESENT, null);
    await upsertAttendance(SESSION_FB_U16_ID, ATHLETE_BURAK_ID, AttendanceStatus.ABSENT, 'Inactive roster');
  });
}
