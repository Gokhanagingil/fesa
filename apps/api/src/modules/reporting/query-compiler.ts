import { BadRequestException } from '@nestjs/common';
import {
  Brackets,
  DataSource,
  ObjectLiteral,
  SelectQueryBuilder,
  WhereExpressionBuilder,
} from 'typeorm';
import type {
  ReportAggregateMeasure,
  ReportAggregateOp,
  ReportEntityKey,
  ReportFieldDefinition,
  ReportFilterCondition,
  ReportFilterGroup,
  ReportFilterNode,
  ReportGroupBy,
  ReportRunRequest,
  ReportRunResponse,
  ReportRunRow,
} from '@amateur/shared-types';
import { Athlete } from '../../database/entities/athlete.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { PrivateLesson } from '../../database/entities/private-lesson.entity';
import { AthleteCharge } from '../../database/entities/athlete-charge.entity';
import { TrainingSession } from '../../database/entities/training-session.entity';
import { InventoryVariant } from '../../database/entities/inventory-variant.entity';
import { getCatalogEntity, getFieldDefinition } from './catalog';
import { validateFilterTree } from './filter-tree';
import {
  ATTENDANCE_PREVIOUS_WINDOW_DAYS,
  ATTENDANCE_RECENT_WINDOW_DAYS,
} from './attendance-intelligence';

interface FieldSql {
  /** SQL fragment evaluating the field. */
  expression: string;
  /** Optional joins to add when this field is referenced (id-keyed for dedup). */
  joins?: Array<{ id: string; apply: (qb: SelectQueryBuilder<ObjectLiteral>) => void }>;
  /** Override SQL used when sorting (e.g. avoid alias quoting issues). */
  sortExpression?: string;
  /** SQL fragment to use in WHERE clauses (defaults to expression). */
  whereExpression?: string;
}

const ENTITY_ALIAS: Record<ReportEntityKey, string> = {
  athletes: 'a',
  guardians: 'g',
  private_lessons: 'lesson',
  finance_charges: 'ac',
  training_sessions: 'session',
  inventory_variants: 'variant',
};

function addDaysUtc(base: Date, amount: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

const TODAY_PARAM = (qb: SelectQueryBuilder<ObjectLiteral>) => {
  const params = qb.getParameters();
  if (!('reportingNow' in params)) {
    const now = new Date();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);
    qb.setParameter('reportingNow', now);
    qb.setParameter('reportingToday', today);
    qb.setParameter(
      'reportingAttendanceRecentStart',
      addDaysUtc(today, -ATTENDANCE_RECENT_WINDOW_DAYS),
    );
    qb.setParameter(
      'reportingAttendancePreviousStart',
      addDaysUtc(today, -(ATTENDANCE_RECENT_WINDOW_DAYS + ATTENDANCE_PREVIOUS_WINDOW_DAYS)),
    );
  }
};

/** Joins applied lazily when a relation is referenced. */
const JOIN_DEFS: Record<string, (qb: SelectQueryBuilder<ObjectLiteral>) => void> = {
  athlete_sport_branch: (qb) =>
    qb.leftJoin('a.sportBranch', 'a_sport_branch'),
  athlete_primary_group: (qb) =>
    qb.leftJoin('a.primaryGroup', 'a_primary_group'),
  charge_athlete: (qb) =>
    qb.leftJoin('ac.athlete', 'ac_athlete'),
  charge_item: (qb) =>
    qb.leftJoin('ac.chargeItem', 'ac_charge_item'),
  lesson_athlete: (qb) =>
    qb.leftJoin('lesson.athlete', 'lesson_athlete'),
  lesson_coach: (qb) =>
    qb.leftJoin('lesson.coach', 'lesson_coach'),
  lesson_charge: (qb) =>
    qb.leftJoin(
      AthleteCharge,
      'lesson_charge',
      'lesson_charge."privateLessonId" = lesson.id AND lesson_charge."tenantId" = lesson."tenantId"',
    ),
  lesson_charge_item: (qb) =>
    qb.leftJoin('lesson_charge.chargeItem', 'lesson_charge_item'),
  training_session_branch: (qb) =>
    qb.leftJoin('session.sportBranch', 'session_branch'),
  training_session_group: (qb) =>
    qb.leftJoin('session.group', 'session_group'),
  training_session_team: (qb) =>
    qb.leftJoin('session.team', 'session_team'),
  training_session_coach: (qb) =>
    qb.leftJoin('session.coach', 'session_coach'),
  variant_item: (qb) => qb.leftJoin('variant.inventoryItem', 'variant_item'),
  variant_branch: (qb) => qb.leftJoin('variant_item.sportBranch', 'variant_branch'),
};

function renderPercentExpression(
  numeratorSql: string,
  denominatorSql: string,
  zeroFallback = 'NULL',
): string {
  return `CASE
    WHEN (${denominatorSql}) > 0
      THEN ROUND(((${numeratorSql})::numeric * 100.0) / NULLIF((${denominatorSql})::numeric, 0), 2)
    ELSE ${zeroFallback}
  END`;
}

function athleteAttendanceCountSql(
  fromParam: string | null,
  toParam: string | null,
  extraCondition?: string,
): string {
  return `(
    SELECT COUNT(*)::int
    FROM attendances att_sub
    INNER JOIN training_sessions session_att
      ON session_att.id = att_sub."trainingSessionId"
      AND session_att."tenantId" = a."tenantId"
    WHERE att_sub."athleteId" = a.id
      AND att_sub."tenantId" = a."tenantId"
      AND session_att.status <> 'cancelled'
      ${fromParam ? `AND session_att."scheduledStart" >= :${fromParam}` : ''}
      ${toParam ? `AND session_att."scheduledStart" < :${toParam}` : ''}
      ${extraCondition ? `AND ${extraCondition}` : ''}
  )`;
}

function athleteLastPresentAtSql(): string {
  return `(
    SELECT MAX(session_att."scheduledStart")
    FROM attendances att_sub
    INNER JOIN training_sessions session_att
      ON session_att.id = att_sub."trainingSessionId"
      AND session_att."tenantId" = a."tenantId"
    WHERE att_sub."athleteId" = a.id
      AND att_sub."tenantId" = a."tenantId"
      AND session_att.status <> 'cancelled'
      AND att_sub.status IN ('present', 'late')
  )`;
}

function trainingRosterCountSql(): string {
  return `(
    SELECT COUNT(*)::int
    FROM athletes athlete_roster
    WHERE athlete_roster."tenantId" = session."tenantId"
      AND athlete_roster."primaryGroupId" = session."groupId"
      AND athlete_roster.status IN ('active', 'trial', 'paused')
      AND (
        session."teamId" IS NULL
        OR EXISTS (
          SELECT 1
          FROM athlete_team_memberships membership_sub
          WHERE membership_sub."tenantId" = athlete_roster."tenantId"
            AND membership_sub."athleteId" = athlete_roster.id
            AND membership_sub."teamId" = session."teamId"
            AND membership_sub."endedAt" IS NULL
        )
      )
  )`;
}

function trainingAttendanceCountSql(extraCondition?: string): string {
  return `(
    SELECT COUNT(*)::int
    FROM attendances attendance_sub
    WHERE attendance_sub."tenantId" = session."tenantId"
      AND attendance_sub."trainingSessionId" = session.id
      ${extraCondition ? `AND ${extraCondition}` : ''}
  )`;
}

/** Fields => SQL expression / joins per entity. */
const ATHLETE_RECORDED_30_SQL = athleteAttendanceCountSql('reportingAttendanceRecentStart', null);
const ATHLETE_ATTENDED_30_SQL = athleteAttendanceCountSql(
  'reportingAttendanceRecentStart',
  null,
  `att_sub.status IN ('present', 'late')`,
);
const ATHLETE_ABSENT_30_SQL = athleteAttendanceCountSql(
  'reportingAttendanceRecentStart',
  null,
  `att_sub.status = 'absent'`,
);
const ATHLETE_EXCUSED_30_SQL = athleteAttendanceCountSql(
  'reportingAttendanceRecentStart',
  null,
  `att_sub.status = 'excused'`,
);
const ATHLETE_RECORDED_PREV_SQL = athleteAttendanceCountSql(
  'reportingAttendancePreviousStart',
  'reportingAttendanceRecentStart',
);
const ATHLETE_ATTENDED_PREV_SQL = athleteAttendanceCountSql(
  'reportingAttendancePreviousStart',
  'reportingAttendanceRecentStart',
  `att_sub.status IN ('present', 'late')`,
);
const ATHLETE_ATTENDANCE_RATE_30_SQL = renderPercentExpression(
  ATHLETE_ATTENDED_30_SQL,
  ATHLETE_RECORDED_30_SQL,
);
const ATHLETE_ATTENDANCE_RATE_PREV_SQL = renderPercentExpression(
  ATHLETE_ATTENDED_PREV_SQL,
  ATHLETE_RECORDED_PREV_SQL,
);
const ATHLETE_LAST_PRESENT_AT_SQL = athleteLastPresentAtSql();
const ATHLETE_ATTENDANCE_DELTA_30_SQL = `CASE
  WHEN (${ATHLETE_RECORDED_PREV_SQL}) > 0
    THEN ROUND(COALESCE((${ATHLETE_ATTENDANCE_RATE_30_SQL}), 0)::numeric - (${ATHLETE_ATTENDANCE_RATE_PREV_SQL})::numeric, 2)
  ELSE NULL
END`;
const ATHLETE_DAYS_SINCE_LAST_PRESENT_SQL = `CASE
  WHEN ${ATHLETE_LAST_PRESENT_AT_SQL} IS NULL
    THEN NULL
  ELSE FLOOR(EXTRACT(EPOCH FROM ((:reportingNow) - (${ATHLETE_LAST_PRESENT_AT_SQL}))) / 86400)::int
END`;

const ATHLETE_FIELDS: Record<string, FieldSql> = {
  'athlete.id': { expression: 'a.id' },
  'athlete.firstName': { expression: 'a."firstName"' },
  'athlete.lastName': { expression: 'a."lastName"' },
  'athlete.preferredName': { expression: 'a."preferredName"' },
  'athlete.gender': { expression: `COALESCE(a.gender, 'unspecified')` },
  'athlete.shirtSize': { expression: 'a."shirtSize"' },
  'athlete.status': { expression: 'a.status' },
  'athlete.birthDate': { expression: 'a."birthDate"' },
  'athlete.birthYear': { expression: 'EXTRACT(YEAR FROM a."birthDate")::int' },
  'athlete.jerseyNumber': { expression: 'a."jerseyNumber"' },
  'athlete.sportBranchName': {
    expression: 'a_sport_branch.name',
    joins: [{ id: 'athlete_sport_branch', apply: JOIN_DEFS.athlete_sport_branch }],
  },
  'athlete.primaryGroupName': {
    expression: 'a_primary_group.name',
    joins: [{ id: 'athlete_primary_group', apply: JOIN_DEFS.athlete_primary_group }],
  },
  'athlete.primaryGroupId': { expression: 'a."primaryGroupId"' },
  'athlete.outstandingTotal': {
    expression: `(
      SELECT COALESCE(SUM(GREATEST(ac_sub.amount::numeric - COALESCE(pa_sum.allocated, 0), 0)), 0)
      FROM athlete_charges ac_sub
      LEFT JOIN (
        SELECT pa_inner."athleteChargeId" AS charge_id, SUM(pa_inner.amount::numeric) AS allocated
        FROM payment_allocations pa_inner
        WHERE pa_inner."tenantId" = a."tenantId"
        GROUP BY pa_inner."athleteChargeId"
      ) pa_sum ON pa_sum.charge_id = ac_sub.id
      WHERE ac_sub."athleteId" = a.id
        AND ac_sub."tenantId" = a."tenantId"
        AND ac_sub.status <> 'cancelled'
    )::numeric(12,2)`,
  },
  'athlete.guardianCount': {
    expression: `(
      SELECT COUNT(*)::int FROM athlete_guardians ag_sub
      WHERE ag_sub."athleteId" = a.id AND ag_sub."tenantId" = a."tenantId"
    )`,
  },
  'athlete.teamCount': {
    expression: `(
      SELECT COUNT(*)::int FROM athlete_team_memberships atm_sub
      WHERE atm_sub."athleteId" = a.id AND atm_sub."tenantId" = a."tenantId" AND atm_sub."endedAt" IS NULL
    )`,
  },
  'athlete.recordedAttendanceCount30d': { expression: ATHLETE_RECORDED_30_SQL },
  'athlete.attendedCount30d': { expression: ATHLETE_ATTENDED_30_SQL },
  'athlete.absentCount30d': { expression: ATHLETE_ABSENT_30_SQL },
  'athlete.excusedCount30d': { expression: ATHLETE_EXCUSED_30_SQL },
  'athlete.attendanceRate30d': { expression: ATHLETE_ATTENDANCE_RATE_30_SQL },
  'athlete.attendanceRateDelta30d': { expression: ATHLETE_ATTENDANCE_DELTA_30_SQL },
  'athlete.lastPresentAt': { expression: ATHLETE_LAST_PRESENT_AT_SQL },
  'athlete.daysSinceLastPresent': { expression: ATHLETE_DAYS_SINCE_LAST_PRESENT_SQL },
};

const GUARDIAN_FIELDS: Record<string, FieldSql> = {
  'guardian.id': { expression: 'g.id' },
  'guardian.firstName': { expression: 'g."firstName"' },
  'guardian.lastName': { expression: 'g."lastName"' },
  'guardian.email': { expression: 'g.email' },
  'guardian.phone': { expression: 'g.phone' },
  'guardian.athleteCount': {
    expression: `(
      SELECT COUNT(*)::int FROM athlete_guardians ag_sub
      WHERE ag_sub."guardianId" = g.id AND ag_sub."tenantId" = g."tenantId"
    )`,
  },
  'guardian.contactComplete': {
    expression: `(g.phone IS NOT NULL AND g.phone <> '' AND g.email IS NOT NULL AND g.email <> '')`,
  },
};

const LESSON_FIELDS: Record<string, FieldSql> = {
  'lesson.id': { expression: 'lesson.id' },
  'lesson.athleteName': {
    expression: `TRIM(CONCAT_WS(' ', lesson_athlete."firstName", lesson_athlete."lastName"))`,
    joins: [{ id: 'lesson_athlete', apply: JOIN_DEFS.lesson_athlete }],
    sortExpression: 'lesson_athlete."lastName"',
  },
  'lesson.coachName': {
    expression: `TRIM(CONCAT_WS(' ', lesson_coach."firstName", lesson_coach."lastName"))`,
    joins: [{ id: 'lesson_coach', apply: JOIN_DEFS.lesson_coach }],
    sortExpression: 'lesson_coach."lastName"',
  },
  'lesson.scheduledStart': { expression: 'lesson."scheduledStart"' },
  'lesson.status': { expression: 'lesson.status' },
  'lesson.attendanceStatus': { expression: 'lesson."attendanceStatus"' },
  'lesson.focus': { expression: 'lesson.focus' },
  'lesson.location': { expression: 'lesson.location' },
  'lesson.chargeStatus': {
    expression: `COALESCE(lesson_charge.status::text, 'unbilled')`,
    joins: [{ id: 'lesson_charge', apply: JOIN_DEFS.lesson_charge }],
  },
  'lesson.chargeOverdue': {
    expression: `(lesson_charge."dueDate" IS NOT NULL AND lesson_charge."dueDate" < CURRENT_DATE AND lesson_charge.status NOT IN ('paid','cancelled'))`,
    joins: [{ id: 'lesson_charge', apply: JOIN_DEFS.lesson_charge }],
  },
  'lesson.chargeRemaining': {
    expression: `COALESCE(GREATEST(lesson_charge.amount::numeric - (
      SELECT COALESCE(SUM(pa_inner.amount::numeric), 0)
      FROM payment_allocations pa_inner
      WHERE pa_inner."athleteChargeId" = lesson_charge.id
    ), 0), 0)::numeric(12,2)`,
    joins: [{ id: 'lesson_charge', apply: JOIN_DEFS.lesson_charge }],
  },
};

const TRAINING_ROSTER_SIZE_SQL = trainingRosterCountSql();
const TRAINING_ATTENDANCE_RECORDED_SQL = trainingAttendanceCountSql();
const TRAINING_ATTENDED_SQL = trainingAttendanceCountSql(
  `attendance_sub.status IN ('present', 'late')`,
);
const TRAINING_ABSENT_SQL = trainingAttendanceCountSql(`attendance_sub.status = 'absent'`);
const TRAINING_EXCUSED_SQL = trainingAttendanceCountSql(`attendance_sub.status = 'excused'`);
const TRAINING_LATE_SQL = trainingAttendanceCountSql(`attendance_sub.status = 'late'`);
const TRAINING_ATTENDANCE_RATE_SQL = renderPercentExpression(
  TRAINING_ATTENDED_SQL,
  TRAINING_ATTENDANCE_RECORDED_SQL,
);
const TRAINING_ABSENCE_RATE_SQL = renderPercentExpression(
  TRAINING_ABSENT_SQL,
  TRAINING_ATTENDANCE_RECORDED_SQL,
);

const TRAINING_SESSION_FIELDS: Record<string, FieldSql> = {
  'session.id': { expression: 'session.id' },
  'session.title': { expression: 'session.title' },
  'session.scheduledStart': { expression: 'session."scheduledStart"' },
  'session.scheduledDate': {
    expression: 'DATE(session."scheduledStart")',
    sortExpression: 'session."scheduledStart"',
    whereExpression: 'DATE(session."scheduledStart")',
  },
  'session.status': { expression: 'session.status' },
  'session.branchName': {
    expression: 'session_branch.name',
    joins: [{ id: 'training_session_branch', apply: JOIN_DEFS.training_session_branch }],
  },
  'session.groupName': {
    expression: 'session_group.name',
    joins: [{ id: 'training_session_group', apply: JOIN_DEFS.training_session_group }],
  },
  'session.teamName': {
    expression: 'session_team.name',
    joins: [{ id: 'training_session_team', apply: JOIN_DEFS.training_session_team }],
  },
  'session.coachName': {
    expression: `COALESCE(NULLIF(TRIM(session_coach."preferredName"), ''), TRIM(CONCAT_WS(' ', session_coach."firstName", session_coach."lastName")))`,
    joins: [{ id: 'training_session_coach', apply: JOIN_DEFS.training_session_coach }],
    sortExpression: 'session_coach."lastName"',
  },
  'session.location': { expression: 'session.location' },
  'session.missingCoach': { expression: '(session."coachId" IS NULL)' },
  'session.missingLocation': {
    expression: `(session.location IS NULL OR TRIM(session.location) = '')`,
  },
  'session.hoursUntilStart': {
    expression: `ROUND((EXTRACT(EPOCH FROM (session."scheduledStart" - :reportingNow)) / 3600.0)::numeric, 2)`,
  },
  'session.rosterSize': { expression: TRAINING_ROSTER_SIZE_SQL },
  'session.attendanceRecordedCount': { expression: TRAINING_ATTENDANCE_RECORDED_SQL },
  'session.attendedCount': { expression: TRAINING_ATTENDED_SQL },
  'session.absentCount': { expression: TRAINING_ABSENT_SQL },
  'session.excusedCount': { expression: TRAINING_EXCUSED_SQL },
  'session.lateCount': { expression: TRAINING_LATE_SQL },
  'session.attendanceRate': { expression: TRAINING_ATTENDANCE_RATE_SQL },
  'session.absenceRate': { expression: TRAINING_ABSENCE_RATE_SQL },
  'session.attendancePending': {
    expression: `(session.status <> 'cancelled' AND session."scheduledEnd" <= :reportingNow AND ${TRAINING_ATTENDANCE_RECORDED_SQL} = 0)`,
  },
};

const CHARGE_FIELDS: Record<string, FieldSql> = {
  'charge.id': { expression: 'ac.id' },
  'charge.athleteName': {
    expression: `TRIM(CONCAT_WS(' ', ac_athlete."firstName", ac_athlete."lastName"))`,
    joins: [{ id: 'charge_athlete', apply: JOIN_DEFS.charge_athlete }],
    sortExpression: 'ac_athlete."lastName"',
  },
  'charge.itemName': {
    expression: 'ac_charge_item.name',
    joins: [{ id: 'charge_item', apply: JOIN_DEFS.charge_item }],
  },
  'charge.itemCategory': {
    expression: 'ac_charge_item.category',
    joins: [{ id: 'charge_item', apply: JOIN_DEFS.charge_item }],
  },
  'charge.amount': { expression: 'ac.amount::numeric(12,2)' },
  'charge.allocatedAmount': {
    expression: `(
      SELECT COALESCE(SUM(pa_inner.amount::numeric), 0)
      FROM payment_allocations pa_inner
      WHERE pa_inner."athleteChargeId" = ac.id AND pa_inner."tenantId" = ac."tenantId"
    )::numeric(12,2)`,
  },
  'charge.remainingAmount': {
    expression: `GREATEST(ac.amount::numeric - (
      SELECT COALESCE(SUM(pa_inner.amount::numeric), 0)
      FROM payment_allocations pa_inner
      WHERE pa_inner."athleteChargeId" = ac.id AND pa_inner."tenantId" = ac."tenantId"
    ), 0)::numeric(12,2)`,
  },
  'charge.dueDate': { expression: 'ac."dueDate"' },
  'charge.derivedStatus': {
    expression: `CASE
      WHEN ac.status = 'cancelled' THEN 'cancelled'
      WHEN (ac.amount::numeric) <= COALESCE((SELECT SUM(pa_inner.amount::numeric) FROM payment_allocations pa_inner WHERE pa_inner."athleteChargeId" = ac.id AND pa_inner."tenantId" = ac."tenantId"), 0) THEN 'paid'
      WHEN COALESCE((SELECT SUM(pa_inner.amount::numeric) FROM payment_allocations pa_inner WHERE pa_inner."athleteChargeId" = ac.id AND pa_inner."tenantId" = ac."tenantId"), 0) > 0 THEN 'partially_paid'
      ELSE 'pending'
    END`,
  },
  'charge.isOverdue': {
    expression: `(ac."dueDate" IS NOT NULL AND ac."dueDate" < CURRENT_DATE AND ac.status NOT IN ('paid','cancelled') AND (
      ac.amount::numeric > COALESCE((SELECT SUM(pa_inner.amount::numeric) FROM payment_allocations pa_inner WHERE pa_inner."athleteChargeId" = ac.id AND pa_inner."tenantId" = ac."tenantId"), 0)
    ))`,
  },
  'charge.fromPrivateLesson': { expression: '(ac."privateLessonId" IS NOT NULL)' },
  'charge.billingPeriodLabel': { expression: 'ac."billingPeriodLabel"' },
};

const INVENTORY_AVAILABLE_SQL = `GREATEST(variant."stockOnHand" - variant."assignedCount", 0)`;
const INVENTORY_THRESHOLD_SQL = `COALESCE(variant."lowStockThreshold", variant_item."lowStockThreshold", 0)`;

const INVENTORY_VARIANT_FIELDS: Record<string, FieldSql> = {
  'inventory.id': { expression: 'variant.id' },
  'inventory.itemName': {
    expression: 'variant_item.name',
    joins: [{ id: 'variant_item', apply: JOIN_DEFS.variant_item }],
  },
  'inventory.itemCategory': {
    expression: 'variant_item.category',
    joins: [{ id: 'variant_item', apply: JOIN_DEFS.variant_item }],
  },
  'inventory.itemSportBranchName': {
    expression: 'variant_branch.name',
    joins: [
      { id: 'variant_item', apply: JOIN_DEFS.variant_item },
      { id: 'variant_branch', apply: JOIN_DEFS.variant_branch },
    ],
  },
  'inventory.size': { expression: 'variant.size' },
  'inventory.number': { expression: 'variant.number' },
  'inventory.color': { expression: 'variant.color' },
  'inventory.stockOnHand': { expression: 'variant."stockOnHand"' },
  'inventory.assignedCount': { expression: 'variant."assignedCount"' },
  'inventory.available': { expression: INVENTORY_AVAILABLE_SQL },
  'inventory.lowStockThreshold': {
    expression: INVENTORY_THRESHOLD_SQL,
    joins: [{ id: 'variant_item', apply: JOIN_DEFS.variant_item }],
  },
  'inventory.isLowStock': {
    expression: `(${INVENTORY_THRESHOLD_SQL} > 0 AND ${INVENTORY_AVAILABLE_SQL} > 0 AND ${INVENTORY_AVAILABLE_SQL} <= ${INVENTORY_THRESHOLD_SQL})`,
    joins: [{ id: 'variant_item', apply: JOIN_DEFS.variant_item }],
  },
  'inventory.isOutOfStock': {
    expression: `(variant."stockOnHand" > 0 AND ${INVENTORY_AVAILABLE_SQL} = 0)`,
  },
  'inventory.isActive': { expression: 'variant."isActive"' },
};

const FIELD_TABLE: Record<ReportEntityKey, Record<string, FieldSql>> = {
  athletes: ATHLETE_FIELDS,
  guardians: GUARDIAN_FIELDS,
  private_lessons: LESSON_FIELDS,
  training_sessions: TRAINING_SESSION_FIELDS,
  finance_charges: CHARGE_FIELDS,
  inventory_variants: INVENTORY_VARIANT_FIELDS,
};

/**
 * Relation existence subqueries used by `exists`/`notExists` operators on relation-check fields.
 * Each builder returns SQL that yields true if the relation has at least one row that matches
 * the predicate; tenant scoping is always enforced inside the subquery.
 */
const RELATION_EXISTS: Record<string, string> = {
  // Athletes
  'athlete.guardiansExist': `EXISTS (
    SELECT 1 FROM athlete_guardians ag_sub
    WHERE ag_sub."athleteId" = a.id AND ag_sub."tenantId" = a."tenantId"
  )`,
  'athlete.privateLessonsExist': `EXISTS (
    SELECT 1 FROM private_lessons pl_sub
    WHERE pl_sub."athleteId" = a.id AND pl_sub."tenantId" = a."tenantId"
  )`,
  'athlete.unpaidChargesExist': `EXISTS (
    SELECT 1 FROM athlete_charges ac_sub
    LEFT JOIN payment_allocations pa_sum ON pa_sum."athleteChargeId" = ac_sub.id
    WHERE ac_sub."athleteId" = a.id AND ac_sub."tenantId" = a."tenantId"
      AND ac_sub.status NOT IN ('paid','cancelled')
    GROUP BY ac_sub.id, ac_sub.amount
    HAVING ac_sub.amount::numeric > COALESCE(SUM(pa_sum.amount::numeric), 0)
  )`,
  'athlete.unpaidPrivateLessonChargesExist': `EXISTS (
    SELECT 1 FROM athlete_charges ac_sub
    WHERE ac_sub."athleteId" = a.id
      AND ac_sub."tenantId" = a."tenantId"
      AND ac_sub."privateLessonId" IS NOT NULL
      AND ac_sub.status NOT IN ('paid','cancelled')
  )`,
  // Guardians
  'guardian.athletesExist': `EXISTS (
    SELECT 1 FROM athlete_guardians ag_sub
    WHERE ag_sub."guardianId" = g.id AND ag_sub."tenantId" = g."tenantId"
  )`,
};

/**
 * Special UUID fields used purely as filters (no projection). They are wired into the
 * compiler so users can ask “athlete in team X” / “athlete NOT in team X”.
 */
const FILTER_ONLY_FIELDS: Record<string, (operator: string, paramName: string) => string> = {
  'athlete.teamId': (operator, paramName) =>
    operator === 'is' || operator === 'in'
      ? `EXISTS (SELECT 1 FROM athlete_team_memberships atm_sub WHERE atm_sub."athleteId" = a.id AND atm_sub."tenantId" = a."tenantId" AND atm_sub."endedAt" IS NULL AND atm_sub."teamId" ${operator === 'in' ? `IN (:...${paramName})` : `= :${paramName}`})`
      : `NOT EXISTS (SELECT 1 FROM athlete_team_memberships atm_sub WHERE atm_sub."athleteId" = a.id AND atm_sub."tenantId" = a."tenantId" AND atm_sub."endedAt" IS NULL AND atm_sub."teamId" ${operator === 'notIn' ? `IN (:...${paramName})` : `= :${paramName}`})`,
  'athlete.primaryGroupId': (operator, paramName) => {
    if (operator === 'is') return `a."primaryGroupId" = :${paramName}`;
    if (operator === 'isNot') return `a."primaryGroupId" IS DISTINCT FROM :${paramName}`;
    if (operator === 'in') return `a."primaryGroupId" IN (:...${paramName})`;
    if (operator === 'notIn') return `(a."primaryGroupId" IS NULL OR a."primaryGroupId" NOT IN (:...${paramName}))`;
    if (operator === 'isEmpty') return `a."primaryGroupId" IS NULL`;
    if (operator === 'isNotEmpty') return `a."primaryGroupId" IS NOT NULL`;
    return `a."primaryGroupId" = :${paramName}`;
  },
};

let paramCounter = 0;

function nextParam(): string {
  paramCounter += 1;
  return `rp_${paramCounter}`;
}

export interface CompileOptions {
  tenantId: string;
}

export class ReportingQueryCompiler {
  constructor(private readonly dataSource: DataSource) {}

  async run(request: ReportRunRequest, options: CompileOptions): Promise<ReportRunResponse> {
    const entity = getCatalogEntity(request.entity);
    if (!entity) {
      throw new BadRequestException(`Unknown reporting entity "${request.entity}".`);
    }

    if (request.groupBy) {
      return this.runGrouped(request, request.groupBy, options);
    }

    const filter = validateFilterTree(request.entity, request.filter ?? null);
    const requestedColumns = (request.columns?.length ? request.columns : entity.defaultColumns)
      .filter((key, idx, arr) => arr.indexOf(key) === idx);
    const sortClauses = request.sort?.length
      ? request.sort
      : entity.defaultSort
      ? [entity.defaultSort]
      : [];

    for (const key of requestedColumns) {
      const def = getFieldDefinition(request.entity, key);
      if (!def) {
        throw new BadRequestException(`Unknown column "${key}" for entity "${request.entity}".`);
      }
      if (def.selectable === false) {
        throw new BadRequestException(`Column "${key}" is not selectable.`);
      }
    }

    for (const sort of sortClauses) {
      const def = getFieldDefinition(request.entity, sort.field);
      if (!def) {
        throw new BadRequestException(`Unknown sort field "${sort.field}".`);
      }
      if (def.sortable === false) {
        throw new BadRequestException(`Sort is not allowed on "${sort.field}".`);
      }
      if (sort.direction !== 'asc' && sort.direction !== 'desc') {
        throw new BadRequestException(`Sort direction must be asc or desc.`);
      }
    }

    const limit = clampLimit(request.limit);
    const offset = Math.max(0, request.offset ?? 0);

    paramCounter = 0;
    const qb = this.buildBaseQuery(request.entity, options.tenantId);
    const appliedJoins = new Set<string>();
    const referenceField = (key: string) => this.applyJoinsForField(qb, request.entity, key, appliedJoins);

    requestedColumns.forEach(referenceField);
    sortClauses.forEach((sort) => referenceField(sort.field));

    if (filter) {
      collectJoinsFromFilter(filter, request.entity, appliedJoins, qb);
    }

    if (request.search?.trim()) {
      this.applyQuickSearch(qb, request.entity, request.search.trim());
    }

    if (filter) {
      qb.andWhere(
        new Brackets((root) => this.applyFilter(root, filter, request.entity, qb)),
      );
    }

    const selectExpressions: string[] = [`${ENTITY_ALIAS[request.entity]}.id AS "_pk"`];
    const aliasFor = (key: string) => `c_${hashKey(key)}`;
    requestedColumns.forEach((key, index) => {
      const def = getFieldDefinition(request.entity, key)!;
      const fieldSql = FIELD_TABLE[request.entity][key];
      if (!fieldSql) {
        throw new BadRequestException(`Column "${key}" cannot be projected (no SQL mapping).`);
      }
      selectExpressions.push(`${fieldSql.expression} AS "${aliasFor(key)}"`);
      // ensure it's also referenced for ordering when sortable; index unused
      void def;
      void index;
    });

    qb.select(selectExpressions);

    sortClauses.forEach((sort) => {
      const fieldSql = FIELD_TABLE[request.entity][sort.field];
      const expression = fieldSql?.sortExpression ?? fieldSql?.expression;
      if (!expression) {
        throw new BadRequestException(`Sort field "${sort.field}" has no SQL projection.`);
      }
      qb.addOrderBy(expression, sort.direction.toUpperCase() as 'ASC' | 'DESC', 'NULLS LAST');
    });

    qb.addOrderBy(`${ENTITY_ALIAS[request.entity]}.id`, 'ASC');

    const countQb = qb.clone();
    countQb.select(`COUNT(DISTINCT ${ENTITY_ALIAS[request.entity]}.id)`, 'count');
    countQb.orderBy();
    const countRow = await countQb.getRawOne<{ count: string }>();
    const total = Number(countRow?.count ?? 0);

    qb.distinct(true);
    qb.offset(offset).limit(limit);

    const rawRows = await qb.getRawMany<Record<string, unknown>>();
    const rows: ReportRunRow[] = rawRows.map((rawRow) => {
      const row: ReportRunRow = {};
      for (const key of requestedColumns) {
        const alias = aliasFor(key);
        const def = getFieldDefinition(request.entity, key)!;
        row[key] = normalizeValueForResponse(rawRow[alias], def);
      }
      return row;
    });

    return {
      entity: request.entity,
      total,
      limit,
      offset,
      columns: requestedColumns,
      rows,
    };
  }

  /**
   * Lightweight grouping/aggregation engine introduced in v2.
   *
   * Constraints kept on purpose:
   *   - exactly one dimension (groupBy.field, must have `groupable: true`),
   *   - up to 6 measures, each one of `count|sum|avg|min|max`,
   *   - measures other than `count` require a numeric/currency field that
   *     declares the requested op in `aggregations`,
   *   - tenant isolation enforced by the same base query as row mode,
   *   - no ORDER BY on raw fields — only by alias of dimension or measure.
   */
  private async runGrouped(
    request: ReportRunRequest,
    groupBy: ReportGroupBy,
    options: CompileOptions,
  ): Promise<ReportRunResponse> {
    const dimensionDef = getFieldDefinition(request.entity, groupBy.field);
    if (!dimensionDef) {
      throw new BadRequestException(`Unknown groupBy field "${groupBy.field}".`);
    }
    if (!dimensionDef.groupable) {
      throw new BadRequestException(`Field "${groupBy.field}" is not groupable.`);
    }
    const dimensionSql = FIELD_TABLE[request.entity][groupBy.field];
    if (!dimensionSql) {
      throw new BadRequestException(`No SQL projection for "${groupBy.field}".`);
    }

    const rawMeasures: ReportAggregateMeasure[] =
      groupBy.measures && groupBy.measures.length > 0
        ? groupBy.measures
        : [{ op: 'count', alias: 'count' }];
    if (rawMeasures.length > 6) {
      throw new BadRequestException('Grouped reports support up to 6 measures.');
    }
    const usedAliases = new Set<string>();
    const measures = rawMeasures.map((measure, index) => {
      const op = measure.op;
      if (!isAggregateOp(op)) {
        throw new BadRequestException(`Unsupported aggregate op "${String(op)}".`);
      }
      let measureField: ReportFieldDefinition | null = null;
      let measureSql: FieldSql | null = null;
      if (op !== 'count') {
        if (!measure.field) {
          throw new BadRequestException(`Aggregate "${op}" requires a field.`);
        }
        measureField = getFieldDefinition(request.entity, measure.field);
        if (!measureField) {
          throw new BadRequestException(`Unknown measure field "${measure.field}".`);
        }
        if (!measureField.aggregations || !measureField.aggregations.includes(op)) {
          throw new BadRequestException(
            `Field "${measure.field}" does not allow aggregate "${op}".`,
          );
        }
        if (measureField.type !== 'number' && measureField.type !== 'currency') {
          throw new BadRequestException(`Field "${measure.field}" is not numeric.`);
        }
        measureSql = FIELD_TABLE[request.entity][measure.field] ?? null;
        if (!measureSql) {
          throw new BadRequestException(`No SQL projection for measure "${measure.field}".`);
        }
      }
      const baseAlias = measure.alias?.trim() || `${op}${index === 0 ? '' : `_${index}`}`;
      let alias = sanitizeAlias(baseAlias);
      if (usedAliases.has(alias)) {
        alias = `${alias}_${index}`;
      }
      usedAliases.add(alias);
      return { op, alias, fieldDef: measureField, fieldSql: measureSql, originalField: measure.field ?? null };
    });

    const limit = clampGroupLimit(groupBy.limit);
    const filter = validateFilterTree(request.entity, request.filter ?? null);

    paramCounter = 0;
    const qb = this.buildBaseQuery(request.entity, options.tenantId);
    const appliedJoins = new Set<string>();
    const referenceField = (key: string) => this.applyJoinsForField(qb, request.entity, key, appliedJoins);
    referenceField(groupBy.field);
    for (const measure of measures) {
      if (measure.op !== 'count' && measure.originalField) {
        referenceField(measure.originalField);
      }
    }

    if (filter) {
      collectJoinsFromFilter(filter, request.entity, appliedJoins, qb);
    }
    if (request.search?.trim()) {
      this.applyQuickSearch(qb, request.entity, request.search.trim());
    }
    if (filter) {
      qb.andWhere(
        new Brackets((root) => this.applyFilter(root, filter, request.entity, qb)),
      );
    }

    const dimensionExpression = dimensionSql.expression;
    const dimensionAlias = sanitizeAlias(`dim_${hashKey(groupBy.field)}`);
    const baseAlias = ENTITY_ALIAS[request.entity];

    const selects: string[] = [`${dimensionExpression} AS "${dimensionAlias}"`];
    for (const measure of measures) {
      selects.push(`${renderAggregateSql(measure.op, measure.fieldSql, baseAlias)} AS "${measure.alias}"`);
    }
    qb.select(selects);
    qb.groupBy(dimensionExpression);

    const sortDirection = groupBy.sort?.direction === 'asc' ? 'ASC' : 'DESC';
    const sortAlias = groupBy.sort?.alias ?? measures[0].alias;
    let sortExpression: string | null = null;
    if (sortAlias === dimensionAlias || sortAlias === groupBy.field) {
      sortExpression = dimensionExpression;
    } else {
      const measure = measures.find((m) => m.alias === sortAlias);
      if (measure) {
        sortExpression = renderAggregateSql(measure.op, measure.fieldSql, baseAlias);
      }
    }
    if (sortExpression) {
      qb.orderBy(sortExpression, sortDirection, 'NULLS LAST');
    } else {
      qb.orderBy(renderAggregateSql('count', null, baseAlias), 'DESC');
    }
    qb.limit(limit);

    const rawRows = await qb.getRawMany<Record<string, unknown>>();
    const columns = [dimensionAlias, ...measures.map((m) => m.alias)];
    const columnLabels = [
      {
        key: dimensionAlias,
        labelKey: dimensionDef.labelKey,
        label: dimensionDef.label ?? dimensionDef.key,
      },
      ...measures.map((m) => ({
        key: m.alias,
        labelKey:
          m.op === 'count'
            ? 'pages.reports.aggregate.measure.count'
            : `pages.reports.aggregate.measure.${m.op}`,
        label: m.op === 'count' ? 'Count' : `${m.op}(${m.originalField ?? ''})`,
        isMeasure: true,
      })),
    ];

    const rows: ReportRunRow[] = rawRows.map((rawRow) => {
      const row: ReportRunRow = {};
      row[dimensionAlias] = normalizeValueForResponse(rawRow[dimensionAlias], dimensionDef);
      for (const measure of measures) {
        const raw = rawRow[measure.alias];
        if (raw === null || raw === undefined) {
          row[measure.alias] = measure.op === 'count' ? 0 : null;
          continue;
        }
        if (measure.op === 'count') {
          row[measure.alias] = Number(raw);
        } else {
          const numeric = Number(raw);
          row[measure.alias] = Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
        }
      }
      return row;
    });

    return {
      entity: request.entity,
      total: rows.length,
      limit,
      offset: 0,
      columns,
      rows,
      groupBy,
      columnLabels,
    };
  }

  private buildBaseQuery(entity: ReportEntityKey, tenantId: string): SelectQueryBuilder<ObjectLiteral> {
    const alias = ENTITY_ALIAS[entity];
    let qb: SelectQueryBuilder<ObjectLiteral>;
    switch (entity) {
      case 'athletes':
        qb = this.dataSource.getRepository(Athlete).createQueryBuilder(alias);
        break;
      case 'guardians':
        qb = this.dataSource.getRepository(Guardian).createQueryBuilder(alias);
        break;
      case 'private_lessons':
        qb = this.dataSource.getRepository(PrivateLesson).createQueryBuilder(alias);
        break;
      case 'finance_charges':
        qb = this.dataSource.getRepository(AthleteCharge).createQueryBuilder(alias);
        break;
      case 'training_sessions':
        qb = this.dataSource.getRepository(TrainingSession).createQueryBuilder(alias);
        break;
      case 'inventory_variants':
        qb = this.dataSource.getRepository(InventoryVariant).createQueryBuilder(alias);
        break;
      default:
        throw new BadRequestException(`Unsupported entity "${entity}".`);
    }
    // Tenant isolation is the cornerstone of every reporting query.
    qb.where(`${alias}."tenantId" = :rp_tenantId`, { rp_tenantId: tenantId });
    TODAY_PARAM(qb);
    return qb;
  }

  private applyJoinsForField(
    qb: SelectQueryBuilder<ObjectLiteral>,
    entity: ReportEntityKey,
    fieldKey: string,
    applied: Set<string>,
  ) {
    const fieldSql = FIELD_TABLE[entity][fieldKey];
    if (!fieldSql?.joins?.length) return;
    for (const join of fieldSql.joins) {
      if (applied.has(join.id)) continue;
      join.apply(qb);
      applied.add(join.id);
    }
  }

  private applyQuickSearch(
    qb: SelectQueryBuilder<ObjectLiteral>,
    entity: ReportEntityKey,
    rawSearch: string,
  ) {
    const term = `%${rawSearch.toLowerCase()}%`;
    const paramName = nextParam();
    qb.setParameter(paramName, term);
    const def = getCatalogEntity(entity)!;
    const quickSearchFields = def.fields.filter((field) => field.quickSearch);
    if (quickSearchFields.length === 0) return;
    qb.andWhere(
      new Brackets((sub) => {
        for (const field of quickSearchFields) {
          const fieldSql = FIELD_TABLE[entity][field.key];
          if (!fieldSql) continue;
          // make sure joins for the quickSearch field are present
          if (fieldSql.joins) {
            for (const join of fieldSql.joins) {
              join.apply(qb);
            }
          }
          sub.orWhere(`LOWER(COALESCE(${fieldSql.expression}::text, '')) LIKE :${paramName}`);
        }
      }),
    );
  }

  private applyFilter(
    where: WhereExpressionBuilder,
    node: ReportFilterNode,
    entity: ReportEntityKey,
    qb: SelectQueryBuilder<ObjectLiteral>,
  ): void {
    if (node.type === 'group') {
      this.applyGroup(where, node, entity, qb);
      return;
    }
    this.applyCondition(where, node, entity, qb);
  }

  private applyGroup(
    where: WhereExpressionBuilder,
    group: ReportFilterGroup,
    entity: ReportEntityKey,
    qb: SelectQueryBuilder<ObjectLiteral>,
  ): void {
    if (!group.children.length) {
      where.andWhere(group.combinator === 'and' ? '1=1' : '1=0');
      return;
    }
    where.andWhere(
      new Brackets((wrapper) => {
        const inner = new Brackets((scope) => {
          group.children.forEach((child, index) => {
            if (index === 0) {
              scope.where(new Brackets((leaf) => this.applyFilter(leaf, child, entity, qb)));
              return;
            }
            const innerBracket = new Brackets((leaf) => this.applyFilter(leaf, child, entity, qb));
            if (group.combinator === 'or') {
              scope.orWhere(innerBracket);
            } else {
              scope.andWhere(innerBracket);
            }
          });
        });
        if (group.not) {
          wrapper.andWhere('NOT').andWhere(inner);
        } else {
          wrapper.andWhere(inner);
        }
      }),
    );
  }

  private applyCondition(
    where: WhereExpressionBuilder,
    condition: ReportFilterCondition,
    entity: ReportEntityKey,
    qb: SelectQueryBuilder<ObjectLiteral>,
  ): void {
    const def = getFieldDefinition(entity, condition.field);
    if (!def) return;

    const filterOnly = FILTER_ONLY_FIELDS[condition.field];
    if (filterOnly) {
      const paramName = nextParam();
      qb.setParameter(paramName, condition.value);
      where.andWhere(filterOnly(condition.operator, paramName));
      return;
    }

    if (def.relationCheck) {
      const subquery = RELATION_EXISTS[condition.field];
      if (!subquery) {
        throw new BadRequestException(`No relation subquery configured for "${condition.field}".`);
      }
      if (condition.operator === 'exists') {
        where.andWhere(subquery);
      } else if (condition.operator === 'notExists') {
        where.andWhere(`NOT (${subquery})`);
      } else {
        throw new BadRequestException(`Field "${condition.field}" only supports exists/notExists.`);
      }
      return;
    }

    const fieldSql = FIELD_TABLE[entity][condition.field];
    if (!fieldSql) {
      throw new BadRequestException(`No SQL mapping for "${condition.field}".`);
    }
    const expression = fieldSql.whereExpression ?? fieldSql.expression;

    switch (condition.operator) {
      case 'isEmpty':
        where.andWhere(`(${expression}) IS NULL OR (${expression})::text = ''`);
        return;
      case 'isNotEmpty':
        where.andWhere(`(${expression}) IS NOT NULL AND (${expression})::text <> ''`);
        return;
      default: {
        const paramName = nextParam();
        if (condition.operator === 'between') {
          if (!Array.isArray(condition.value) || condition.value.length !== 2) {
            throw new BadRequestException(`Operator "between" requires a [min, max] tuple.`);
          }
          qb.setParameter(`${paramName}_min`, condition.value[0]);
          qb.setParameter(`${paramName}_max`, condition.value[1]);
          where.andWhere(`(${expression}) BETWEEN :${paramName}_min AND :${paramName}_max`);
          return;
        }
        const sql = renderOperator(condition.operator, expression, paramName);
        qb.setParameter(paramName, formatParam(condition.operator, condition.value));
        where.andWhere(sql);
      }
    }
  }
}

function clampLimit(requested: number | undefined): number {
  if (!requested || requested <= 0) return 50;
  return Math.min(requested, 1000);
}

function clampGroupLimit(requested: number | undefined): number {
  if (!requested || requested <= 0) return 50;
  return Math.min(requested, 200);
}

function hashKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9]+/g, '_');
}

function sanitizeAlias(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned.length === 0 ? 'col' : cleaned.slice(0, 60);
}

function isAggregateOp(op: unknown): op is ReportAggregateOp {
  return op === 'count' || op === 'sum' || op === 'avg' || op === 'min' || op === 'max';
}

function renderAggregateSql(
  op: ReportAggregateOp,
  fieldSql: FieldSql | null,
  baseAlias: string,
): string {
  if (op === 'count') {
    return `COUNT(DISTINCT ${baseAlias}.id)`;
  }
  const expression = fieldSql?.expression;
  if (!expression) {
    throw new BadRequestException(`Aggregate ${op} requires a SQL expression.`);
  }
  switch (op) {
    case 'sum':
      return `COALESCE(SUM((${expression})::numeric), 0)::numeric(14,2)`;
    case 'avg':
      return `COALESCE(AVG((${expression})::numeric), 0)::numeric(14,2)`;
    case 'min':
      return `MIN((${expression})::numeric)::numeric(14,2)`;
    case 'max':
      return `MAX((${expression})::numeric)::numeric(14,2)`;
    default:
      throw new BadRequestException(`Unsupported aggregate "${op}".`);
  }
}

function renderOperator(operator: string, expression: string, paramName: string): string {
  switch (operator) {
    case 'is':
      return `(${expression}) = :${paramName}`;
    case 'isNot':
      return `(${expression}) IS DISTINCT FROM :${paramName}`;
    case 'contains':
      return `LOWER((${expression})::text) LIKE :${paramName}`;
    case 'notContains':
      return `LOWER((${expression})::text) NOT LIKE :${paramName}`;
    case 'startsWith':
      return `LOWER((${expression})::text) LIKE :${paramName}`;
    case 'endsWith':
      return `LOWER((${expression})::text) LIKE :${paramName}`;
    case 'in':
      return `(${expression}) IN (:...${paramName})`;
    case 'notIn':
      return `((${expression}) IS NULL OR (${expression}) NOT IN (:...${paramName}))`;
    case 'gt':
      return `(${expression}) > :${paramName}`;
    case 'gte':
      return `(${expression}) >= :${paramName}`;
    case 'lt':
      return `(${expression}) < :${paramName}`;
    case 'lte':
      return `(${expression}) <= :${paramName}`;
    case 'between':
      return `(${expression}) BETWEEN :${paramName}_min AND :${paramName}_max`;
    default:
      throw new BadRequestException(`Unsupported operator "${operator}".`);
  }
}

function formatParam(operator: string, value: unknown): unknown {
  if (operator === 'between' && Array.isArray(value)) {
    // We rely on TypeORM's parameter expansion; but BETWEEN uses two params.
    // Trick: expose as object with both halves.
    // Returning raw array would not bind to our pattern, so we handle separately:
    return value;
  }
  if (operator === 'contains' || operator === 'notContains') {
    return `%${String(value ?? '').toLowerCase()}%`;
  }
  if (operator === 'startsWith') {
    return `${String(value ?? '').toLowerCase()}%`;
  }
  if (operator === 'endsWith') {
    return `%${String(value ?? '').toLowerCase()}`;
  }
  return value;
}

function collectJoinsFromFilter(
  node: ReportFilterNode,
  entity: ReportEntityKey,
  applied: Set<string>,
  qb: SelectQueryBuilder<ObjectLiteral>,
) {
  if (node.type === 'group') {
    node.children.forEach((child) => collectJoinsFromFilter(child, entity, applied, qb));
    return;
  }
  const fieldSql = FIELD_TABLE[entity][node.field];
  if (fieldSql?.joins) {
    for (const join of fieldSql.joins) {
      if (applied.has(join.id)) continue;
      join.apply(qb);
      applied.add(join.id);
    }
  }
}

function normalizeValueForResponse(
  value: unknown,
  def: ReportFieldDefinition,
): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  switch (def.type) {
    case 'number':
      return typeof value === 'number' ? value : Number(value);
    case 'currency': {
      const numeric = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
    }
    case 'boolean':
      return Boolean(value);
    case 'date':
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value);
    case 'datetime':
      if (value instanceof Date) return value.toISOString();
      return String(value);
    case 'string':
    case 'enum':
    case 'uuid':
    default:
      return typeof value === 'string' ? value : String(value);
  }
}

