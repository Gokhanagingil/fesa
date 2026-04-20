import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Coach } from '../../database/entities/coach.entity';
import { Guardian } from '../../database/entities/guardian.entity';
import { ImportBatch, ImportBatchStatus } from '../../database/entities/import-batch.entity';
import { InventoryItem } from '../../database/entities/inventory-item.entity';
import { SportBranch } from '../../database/entities/sport-branch.entity';
import { Team } from '../../database/entities/team.entity';
import { Tenant } from '../../database/entities/tenant.entity';

export type OnboardingStepStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'needs_attention';

/**
 * A small, calm summary of the most recent import for an onboarding step.
 * Nothing here describes raw rows or schemas — it answers "what landed last
 * time, when, and did it look healthy?".
 */
export interface OnboardingStepLastImport {
  batchId: string;
  status: ImportBatchStatus;
  committedAt: string;
  source: string | null;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  rejectedRows: number;
  warningRows: number;
  triggeredBy: string | null;
}

/**
 * One step on the guided club onboarding rail. Each step maps either to a
 * downloadable import template or to a non-import readiness check (club
 * basics, go-live review). Counts are honest, deduplicated reads against
 * the same tables the rest of the product uses — no parallel state store.
 */
export interface OnboardingStepReport {
  /** Stable step identifier used by the wizard URL/query state. */
  key: string;
  /** i18n key under `pages.onboarding.steps.<key>.title`. */
  titleKey: string;
  /** Short i18n hint key under `pages.onboarding.steps.<key>.hint`. */
  hintKey: string;
  /**
   * If this step is backed by an importable entity, the entity key used by
   * `/api/imports/template`, `/api/imports/preview`, and `/api/imports/commit`.
   * Steps that aren't import-backed (club basics, review) leave this null.
   */
  importEntity:
    | 'sport_branches'
    | 'coaches'
    | 'groups'
    | 'teams'
    | 'athletes'
    | 'guardians'
    | 'athlete_guardians'
    | 'charge_items'
    | 'inventory_items'
    | null;
  /** Number of records currently present for this step. */
  count: number;
  /** Friendly status used for the calm step rail. */
  status: OnboardingStepStatus;
  /**
   * True when this step's prerequisites are not met yet (e.g. you cannot
   * meaningfully import groups before a sport branch exists).
   */
  blocked: boolean;
  /** Names of prerequisite steps the user should complete first. */
  blockedBy: string[];
  /** True when the wizard considers this step optional for go-live. */
  optional: boolean;
  /**
   * The most recent server-recorded import batch for this step's entity, if
   * any. Null for non-import steps and for steps that have never been
   * imported through the wizard / classic surface.
   */
  lastImport: OnboardingStepLastImport | null;
}

export interface OnboardingProgress {
  /** Steps required for the wizard to consider the club "ready". */
  requiredCompleted: number;
  requiredTotal: number;
  /** Same shape but counting every step (including optional ones). */
  totalCompleted: number;
  totalSteps: number;
  /** Calm summary state for the page header. */
  state: 'fresh' | 'in_progress' | 'ready';
}

/**
 * One readiness signal surfaced in the go-live review. Each signal has an
 * obvious tone (`ok`, `warning`, `info`) and a short i18n key the UI
 * resolves with optional placeholders.
 */
export interface OnboardingReadinessSignal {
  key: string;
  tone: 'ok' | 'warning' | 'info';
  messageKey: string;
  /** i18n placeholders. */
  values?: Record<string, string | number>;
  /** Optional wizard step the signal points back to. */
  stepKey?: string;
}

export interface OnboardingReadiness {
  /**
   * Calm, scoped view of how confident the club should feel. We never say
   * "ready to go live" without honest inspection — see `tone` mapping in
   * `computeReadiness` below.
   */
  tone: 'fresh' | 'in_progress' | 'almost_ready' | 'ready';
  /** Short i18n key for the headline (e.g. "You're close."). */
  headlineKey: string;
  /** Short i18n key for a one-line subtitle. */
  subtitleKey: string;
  /** Required steps that aren't completed yet. */
  outstandingRequiredSteps: string[];
  /** Optional steps the club could revisit before going live. */
  outstandingOptionalSteps: string[];
  signals: OnboardingReadinessSignal[];
}

/** Compact recent-history entry for the wizard's "Recent imports" strip. */
export interface OnboardingHistoryEntry {
  id: string;
  entity: string;
  /** Stable onboarding step key the entry belongs to (mirrors `entity`). */
  stepKey: string;
  status: ImportBatchStatus;
  committedAt: string;
  source: string | null;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  rejectedRows: number;
  warningRows: number;
  durationMs: number;
  triggeredBy: string | null;
  /**
   * Calm "what could you safely do next with this batch?" hint key. The wizard
   * uses it to render a single supportive line on the history card without
   * pretending we can roll back anything.
   */
  replayHintKey: string;
  /**
   * True when re-running this step (uploading a corrected file) is the
   * recommended supportive next move. We never auto-trigger replay; this
   * just enables a calm "Try again with a corrected file" affordance.
   */
  retryRecommended: boolean;
}

/** Detailed view of a single recorded batch — used by the calm batch drawer. */
export interface OnboardingBatchDetail extends OnboardingHistoryEntry {
  /** Up to ~6 short hint lines captured during the original validation pass. */
  hints: string[];
}

/**
 * One supportive recommendation surfaced in the go-live review. Each entry is
 * deliberately short, honest, and points back to a concrete in-product
 * surface — never invented certainty.
 */
export interface OnboardingRecommendedAction {
  key: string;
  /** Short i18n key for the action title. */
  titleKey: string;
  /** Short i18n key for the supportive subtitle. */
  hintKey: string;
  /** Optional onboarding step key the action deep-links into. */
  stepKey?: string;
  /** Optional in-app route the action deep-links into. */
  to?: string;
}

/**
 * Calm "first 30 days" strip surfaced once a club has finished the required
 * steps. Each item is a single supportive next move, not a checklist item the
 * platform tracks completion for. We deliberately keep this short so the
 * post-onboarding experience reduces fear instead of creating a new
 * admin workload.
 */
export interface OnboardingFirstThirtyDaysItem {
  key: string;
  titleKey: string;
  hintKey: string;
  to?: string;
  stepKey?: string;
}

export interface OnboardingFirstThirtyDays {
  /**
   * `dormant` — required steps not done yet, the strip stays gentle.
   * `active`  — required steps done, the strip becomes the post-onboarding
   *             companion and is the primary panel on the go-live step.
   */
  state: 'dormant' | 'active';
  headlineKey: string;
  subtitleKey: string;
  items: OnboardingFirstThirtyDaysItem[];
}

export interface OnboardingStateReport {
  tenantId: string;
  tenantName: string;
  brandConfigured: boolean;
  steps: OnboardingStepReport[];
  progress: OnboardingProgress;
  /** First step the wizard would invite the user to act on. */
  nextStepKey: string | null;
  /** Calm go-live readiness summary, computed from the steps + signals. */
  readiness: OnboardingReadiness;
  /** Up to a handful of the most recent server-recorded import batches. */
  recentImports: OnboardingHistoryEntry[];
  /**
   * Short, honest list of recommended next actions surfaced in the go-live
   * review. Empty when the club has nothing supportive to nudge.
   */
  recommendedActions: OnboardingRecommendedAction[];
  /**
   * Calm "first 30 days" companion. Stays in `dormant` mode until the
   * required onboarding steps are done; once active, it becomes the
   * primary panel on the go-live step.
   */
  firstThirtyDays: OnboardingFirstThirtyDays;
  generatedAt: string;
}

const STEP_TO_ENTITY: Record<string, string> = {
  sport_branches: 'sport_branches',
  coaches: 'coaches',
  groups: 'groups',
  teams: 'teams',
  athletes: 'athletes',
  guardians: 'guardians',
  athlete_guardians: 'athlete_guardians',
  charge_items: 'charge_items',
  inventory_items: 'inventory_items',
};

const ENTITY_TO_STEP: Record<string, string> = Object.fromEntries(
  Object.entries(STEP_TO_ENTITY).map(([step, entity]) => [entity, step]),
);

/** A small, opinionated "this number feels suspiciously low" signal. */
function isSuspiciouslyLowAthleteCount(count: number): boolean {
  return count > 0 && count < 4;
}

@Injectable()
export class OnboardingService {
  constructor(
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    @InjectRepository(SportBranch) private readonly branches: Repository<SportBranch>,
    @InjectRepository(Coach) private readonly coaches: Repository<Coach>,
    @InjectRepository(ClubGroup) private readonly groups: Repository<ClubGroup>,
    @InjectRepository(Team) private readonly teams: Repository<Team>,
    @InjectRepository(Athlete) private readonly athletes: Repository<Athlete>,
    @InjectRepository(Guardian) private readonly guardians: Repository<Guardian>,
    @InjectRepository(AthleteGuardian)
    private readonly athleteGuardians: Repository<AthleteGuardian>,
    @InjectRepository(ChargeItem) private readonly chargeItems: Repository<ChargeItem>,
    @InjectRepository(InventoryItem) private readonly inventoryItems: Repository<InventoryItem>,
    @InjectRepository(ImportBatch) private readonly importBatches: Repository<ImportBatch>,
  ) {}

  async getState(tenantId: string): Promise<OnboardingStateReport> {
    const tenant = await this.tenants.findOne({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const where = { tenantId } as const;
    const [
      branchCount,
      coachCount,
      groupCount,
      teamCount,
      athleteCount,
      guardianCount,
      linkCount,
      chargeCount,
      inventoryCount,
      lastBatchesPerEntity,
      recentBatches,
    ] = await Promise.all([
      this.branches.count({ where }),
      this.coaches.count({ where }),
      this.groups.count({ where }),
      this.teams.count({ where }),
      this.athletes.count({ where }),
      this.guardians.count({ where }),
      this.athleteGuardians.count({ where }),
      this.chargeItems.count({ where }),
      this.inventoryItems.count({ where }),
      this.fetchLastBatchesPerEntity(tenantId),
      this.fetchRecentBatches(tenantId, 6),
    ]);

    const brandConfigured = Boolean(
      tenant.brandDisplayName ||
        tenant.brandTagline ||
        tenant.brandPrimaryColor ||
        tenant.brandLogoUrl ||
        tenant.brandLogoAssetFileName,
    );

    const blockedBy = (count: number, dep: string) => (count > 0 ? [] : [dep]);

    const lastImportFor = (entity: string): OnboardingStepLastImport | null => {
      const batch = lastBatchesPerEntity.get(entity);
      if (!batch) return null;
      return {
        batchId: batch.id,
        status: batch.status,
        committedAt: batch.createdAt.toISOString(),
        source: batch.source,
        totalRows: batch.totalRows,
        createdRows: batch.createdRows,
        updatedRows: batch.updatedRows,
        skippedRows: batch.skippedRows,
        rejectedRows: batch.rejectedRows,
        warningRows: batch.warningRows,
        triggeredBy: batch.triggeredByDisplayName,
      };
    };

    const steps: OnboardingStepReport[] = [
      {
        key: 'club_basics',
        titleKey: 'pages.onboarding.steps.club_basics.title',
        hintKey: 'pages.onboarding.steps.club_basics.hint',
        importEntity: null,
        count: brandConfigured ? 1 : 0,
        status: brandConfigured ? 'completed' : 'not_started',
        blocked: false,
        blockedBy: [],
        optional: false,
        lastImport: null,
      },
      {
        key: 'sport_branches',
        titleKey: 'pages.onboarding.steps.sport_branches.title',
        hintKey: 'pages.onboarding.steps.sport_branches.hint',
        importEntity: 'sport_branches',
        count: branchCount,
        status: branchCount > 0 ? 'completed' : 'not_started',
        blocked: false,
        blockedBy: [],
        optional: false,
        lastImport: lastImportFor('sport_branches'),
      },
      {
        key: 'coaches',
        titleKey: 'pages.onboarding.steps.coaches.title',
        hintKey: 'pages.onboarding.steps.coaches.hint',
        importEntity: 'coaches',
        count: coachCount,
        status: coachCount > 0 ? 'completed' : 'not_started',
        blocked: branchCount === 0,
        blockedBy: blockedBy(branchCount, 'sport_branches'),
        optional: false,
        lastImport: lastImportFor('coaches'),
      },
      {
        key: 'groups',
        titleKey: 'pages.onboarding.steps.groups.title',
        hintKey: 'pages.onboarding.steps.groups.hint',
        importEntity: 'groups',
        count: groupCount,
        status: groupCount > 0 ? 'completed' : 'not_started',
        blocked: branchCount === 0,
        blockedBy: blockedBy(branchCount, 'sport_branches'),
        optional: false,
        lastImport: lastImportFor('groups'),
      },
      {
        key: 'teams',
        titleKey: 'pages.onboarding.steps.teams.title',
        hintKey: 'pages.onboarding.steps.teams.hint',
        importEntity: 'teams',
        count: teamCount,
        status: teamCount > 0 ? 'completed' : 'not_started',
        blocked: branchCount === 0,
        blockedBy: blockedBy(branchCount, 'sport_branches'),
        optional: true,
        lastImport: lastImportFor('teams'),
      },
      {
        key: 'athletes',
        titleKey: 'pages.onboarding.steps.athletes.title',
        hintKey: 'pages.onboarding.steps.athletes.hint',
        importEntity: 'athletes',
        count: athleteCount,
        status: athleteCount > 0 ? 'completed' : 'not_started',
        blocked: branchCount === 0,
        blockedBy: blockedBy(branchCount, 'sport_branches'),
        optional: false,
        lastImport: lastImportFor('athletes'),
      },
      {
        key: 'guardians',
        titleKey: 'pages.onboarding.steps.guardians.title',
        hintKey: 'pages.onboarding.steps.guardians.hint',
        importEntity: 'guardians',
        count: guardianCount,
        status: guardianCount > 0 ? 'completed' : 'not_started',
        blocked: false,
        blockedBy: [],
        optional: false,
        lastImport: lastImportFor('guardians'),
      },
      {
        key: 'athlete_guardians',
        titleKey: 'pages.onboarding.steps.athlete_guardians.title',
        hintKey: 'pages.onboarding.steps.athlete_guardians.hint',
        importEntity: 'athlete_guardians',
        count: linkCount,
        status: linkCount > 0 ? 'completed' : 'not_started',
        blocked: athleteCount === 0 || guardianCount === 0,
        blockedBy: [
          ...blockedBy(athleteCount, 'athletes'),
          ...blockedBy(guardianCount, 'guardians'),
        ],
        optional: false,
        lastImport: lastImportFor('athlete_guardians'),
      },
      {
        key: 'charge_items',
        titleKey: 'pages.onboarding.steps.charge_items.title',
        hintKey: 'pages.onboarding.steps.charge_items.hint',
        importEntity: 'charge_items',
        count: chargeCount,
        status: chargeCount > 0 ? 'completed' : 'not_started',
        blocked: false,
        blockedBy: [],
        optional: true,
        lastImport: lastImportFor('charge_items'),
      },
      {
        key: 'inventory_items',
        titleKey: 'pages.onboarding.steps.inventory_items.title',
        hintKey: 'pages.onboarding.steps.inventory_items.hint',
        importEntity: 'inventory_items',
        count: inventoryCount,
        status: inventoryCount > 0 ? 'completed' : 'not_started',
        blocked: false,
        blockedBy: [],
        optional: true,
        lastImport: lastImportFor('inventory_items'),
      },
      {
        key: 'go_live',
        titleKey: 'pages.onboarding.steps.go_live.title',
        hintKey: 'pages.onboarding.steps.go_live.hint',
        importEntity: null,
        count: 0,
        status: 'not_started',
        blocked: false,
        blockedBy: [],
        optional: false,
        lastImport: null,
      },
    ];

    // Mark the go-live step depending on completion of required steps.
    const requiredSteps = steps.filter((step) => !step.optional && step.key !== 'go_live');
    const requiredCompleted = requiredSteps.filter((step) => step.status === 'completed').length;
    const goLive = steps.find((s) => s.key === 'go_live')!;
    if (requiredCompleted === requiredSteps.length) {
      goLive.status = 'in_progress';
    }

    // Surface "needs_attention" when a step is blocked by a missing prereq,
    // or when its most recent server-recorded import landed with rejected /
    // warning rows the operator hasn't revisited yet.
    for (const step of steps) {
      if (step.blocked && step.status === 'not_started') {
        step.status = 'needs_attention';
      }
      if (
        step.lastImport &&
        (step.lastImport.rejectedRows > 0 || step.lastImport.warningRows > 0) &&
        step.status === 'completed'
      ) {
        step.status = 'needs_attention';
      }
    }

    const totalCompleted = steps.filter((step) => step.status === 'completed').length;
    const overallState: OnboardingProgress['state'] =
      totalCompleted === 0
        ? 'fresh'
        : requiredCompleted === requiredSteps.length
          ? 'ready'
          : 'in_progress';

    const nextStep = steps.find(
      (step) =>
        step.key !== 'go_live' &&
        step.status !== 'completed' &&
        !step.blocked,
    );

    const readiness = this.computeReadiness({
      steps,
      requiredSteps,
      requiredCompleted,
      brandConfigured,
      athleteCount,
      guardianCount,
      linkCount,
      groupCount,
    });

    const recentImports = recentBatches.map((batch) => this.toHistoryEntry(batch));

    const recommendedActions = this.buildRecommendedActions({
      steps,
      requiredAllDone: requiredCompleted === requiredSteps.length,
      brandConfigured,
      readinessSignals: readiness.signals,
      recentImports,
    });

    const firstThirtyDays = this.buildFirstThirtyDays({
      readyForLaunch: overallState === 'ready',
    });

    return {
      tenantId,
      tenantName: tenant.name,
      brandConfigured,
      steps,
      progress: {
        requiredCompleted,
        requiredTotal: requiredSteps.length,
        totalCompleted,
        totalSteps: steps.length,
        state: overallState,
      },
      nextStepKey: nextStep?.key ?? 'go_live',
      readiness,
      recentImports,
      recommendedActions,
      firstThirtyDays,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Returns the most recent N server-recorded import batches for this
   * tenant, newest first. This is the data source behind the wizard's
   * "Recent imports" strip and the dedicated history endpoint.
   *
   * When `step` is provided, the response is scoped to that onboarding step
   * (the underlying entity). Useful for the per-step "see all imports for
   * this step" drawer.
   */
  async getHistory(
    tenantId: string,
    options: { limit?: number; step?: string } = {},
  ): Promise<OnboardingHistoryEntry[]> {
    const limit = options.limit ?? 25;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const entity = options.step ? STEP_TO_ENTITY[options.step] ?? null : null;
    const where = entity ? { tenantId, entity } : { tenantId };
    const batches = await this.importBatches.find({
      where,
      order: { createdAt: 'DESC' },
      take: safeLimit,
    });
    return batches.map((batch) => this.toHistoryEntry(batch));
  }

  /**
   * Returns the calm "what happened in this batch?" view used by the wizard
   * batch drawer. Returns null when the batch does not exist for this
   * tenant — callers should translate that into a 404.
   */
  async getBatch(tenantId: string, batchId: string): Promise<OnboardingBatchDetail | null> {
    const batch = await this.importBatches.findOne({ where: { id: batchId, tenantId } });
    if (!batch) return null;
    return {
      ...this.toHistoryEntry(batch),
      hints: parseSummaryHints(batch.summary),
    };
  }

  private async fetchRecentBatches(tenantId: string, limit: number): Promise<ImportBatch[]> {
    return this.importBatches.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Map a stored batch row into the wire-shape used by the wizard. We attach
   * a single calm replay hint so the UI can render supportive guidance
   * without inventing a rollback story.
   */
  private toHistoryEntry(batch: ImportBatch): OnboardingHistoryEntry {
    const stepKey = ENTITY_TO_STEP[batch.entity] ?? batch.entity;
    const replayHint = buildReplayHint(batch);
    return {
      id: batch.id,
      entity: batch.entity,
      stepKey,
      status: batch.status,
      committedAt: batch.createdAt.toISOString(),
      source: batch.source,
      totalRows: batch.totalRows,
      createdRows: batch.createdRows,
      updatedRows: batch.updatedRows,
      skippedRows: batch.skippedRows,
      rejectedRows: batch.rejectedRows,
      warningRows: batch.warningRows,
      durationMs: batch.durationMs,
      triggeredBy: batch.triggeredByDisplayName,
      replayHintKey: replayHint.key,
      retryRecommended: replayHint.retryRecommended,
    };
  }

  private async fetchLastBatchesPerEntity(tenantId: string): Promise<Map<string, ImportBatch>> {
    // The dataset is small (capped recent history) so a per-entity scan is
    // fine here — we'd reach for window functions only if it ever grew.
    const recent = await this.importBatches.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
      take: 60,
    });
    const map = new Map<string, ImportBatch>();
    for (const batch of recent) {
      if (!map.has(batch.entity)) {
        map.set(batch.entity, batch);
      }
    }
    return map;
  }

  /**
   * Honest, supportive readiness summary. We deliberately distinguish:
   *
   *   - `fresh`:        nothing required is done — calm "let's get started".
   *   - `in_progress`:  some required steps remain.
   *   - `almost_ready`: required steps done, but soft signals raised
   *                      attention-worthy concerns (very small athlete
   *                      count, missing brand, no athlete↔guardian links
   *                      with athletes present, etc.).
   *   - `ready`:        required steps done and no soft signals raised.
   */
  private computeReadiness(input: {
    steps: OnboardingStepReport[];
    requiredSteps: OnboardingStepReport[];
    requiredCompleted: number;
    brandConfigured: boolean;
    athleteCount: number;
    guardianCount: number;
    linkCount: number;
    groupCount: number;
  }): OnboardingReadiness {
    const {
      steps,
      requiredSteps,
      requiredCompleted,
      brandConfigured,
      athleteCount,
      guardianCount,
      linkCount,
      groupCount,
    } = input;

    const outstandingRequiredSteps = requiredSteps
      .filter((step) => step.status !== 'completed')
      .map((step) => step.key);
    const outstandingOptionalSteps = steps
      .filter((step) => step.optional && step.status !== 'completed')
      .map((step) => step.key);

    const signals: OnboardingReadinessSignal[] = [];

    // Soft signals — calmly worded, never alarming.
    if (!brandConfigured) {
      signals.push({
        key: 'brand_missing',
        tone: 'info',
        messageKey: 'pages.onboarding.readiness.signals.brandMissing',
        stepKey: 'club_basics',
      });
    }
    if (athleteCount > 0 && groupCount === 0) {
      signals.push({
        key: 'athletes_without_groups',
        tone: 'warning',
        messageKey: 'pages.onboarding.readiness.signals.athletesWithoutGroups',
        stepKey: 'groups',
      });
    }
    if (athleteCount > 0 && guardianCount > 0 && linkCount === 0) {
      signals.push({
        key: 'links_missing',
        tone: 'warning',
        messageKey: 'pages.onboarding.readiness.signals.linksMissing',
        stepKey: 'athlete_guardians',
      });
    }
    if (isSuspiciouslyLowAthleteCount(athleteCount)) {
      signals.push({
        key: 'low_athlete_count',
        tone: 'info',
        messageKey: 'pages.onboarding.readiness.signals.lowAthleteCount',
        values: { count: athleteCount },
        stepKey: 'athletes',
      });
    }
    for (const step of steps) {
      if (step.lastImport && step.lastImport.rejectedRows > 0) {
        signals.push({
          key: `rejected_rows_${step.key}`,
          tone: 'warning',
          messageKey: 'pages.onboarding.readiness.signals.rejectedRows',
          values: { count: step.lastImport.rejectedRows },
          stepKey: step.key,
        });
      }
    }

    const requiredAllDone = requiredCompleted === requiredSteps.length;
    const hasWarning = signals.some((signal) => signal.tone === 'warning');
    const tone: OnboardingReadiness['tone'] = !requiredAllDone
      ? requiredCompleted === 0
        ? 'fresh'
        : 'in_progress'
      : hasWarning
        ? 'almost_ready'
        : 'ready';

    const headlineKey = `pages.onboarding.readiness.headline.${tone}`;
    const subtitleKey = `pages.onboarding.readiness.subtitle.${tone}`;

    return {
      tone,
      headlineKey,
      subtitleKey,
      outstandingRequiredSteps,
      outstandingOptionalSteps,
      signals,
    };
  }

  /** Convenience: maps a stored entity key back to its onboarding step. */
  static stepKeyForEntity(entity: string): string | null {
    return ENTITY_TO_STEP[entity] ?? null;
  }

  /**
   * Build the calm "recommended next actions" list rendered in the go-live
   * review. We deliberately keep this short (top ~5) and only surface
   * actions that map to a real step or in-product surface — never invented
   * certainty or fake checklists.
   */
  private buildRecommendedActions(input: {
    steps: OnboardingStepReport[];
    requiredAllDone: boolean;
    brandConfigured: boolean;
    readinessSignals: OnboardingReadinessSignal[];
    recentImports: OnboardingHistoryEntry[];
  }): OnboardingRecommendedAction[] {
    const { steps, requiredAllDone, brandConfigured, readinessSignals, recentImports } = input;
    const actions: OnboardingRecommendedAction[] = [];

    const stepsNeedingAttention = steps.filter(
      (step) => step.status === 'needs_attention' && step.key !== 'go_live',
    );
    for (const step of stepsNeedingAttention.slice(0, 3)) {
      actions.push({
        key: `attention_${step.key}`,
        titleKey: 'pages.onboarding.recommendations.reviewStep.title',
        hintKey: 'pages.onboarding.recommendations.reviewStep.hint',
        stepKey: step.key,
      });
    }

    if (!brandConfigured) {
      actions.push({
        key: 'configure_brand',
        titleKey: 'pages.onboarding.recommendations.configureBrand.title',
        hintKey: 'pages.onboarding.recommendations.configureBrand.hint',
        to: '/app/settings',
        stepKey: 'club_basics',
      });
    }

    const linksMissingSignal = readinessSignals.find((signal) => signal.key === 'links_missing');
    if (linksMissingSignal) {
      actions.push({
        key: 'link_families',
        titleKey: 'pages.onboarding.recommendations.linkFamilies.title',
        hintKey: 'pages.onboarding.recommendations.linkFamilies.hint',
        stepKey: 'athlete_guardians',
      });
    }

    const athletesWithoutGroupsSignal = readinessSignals.find(
      (signal) => signal.key === 'athletes_without_groups',
    );
    if (athletesWithoutGroupsSignal) {
      actions.push({
        key: 'create_group',
        titleKey: 'pages.onboarding.recommendations.createGroup.title',
        hintKey: 'pages.onboarding.recommendations.createGroup.hint',
        stepKey: 'groups',
      });
    }

    const recentNeedsAttention = recentImports.find((entry) => entry.status === 'needs_attention');
    if (recentNeedsAttention) {
      actions.push({
        key: `revisit_${recentNeedsAttention.id}`,
        titleKey: 'pages.onboarding.recommendations.revisitBatch.title',
        hintKey: 'pages.onboarding.recommendations.revisitBatch.hint',
        stepKey: recentNeedsAttention.stepKey,
      });
    }

    if (requiredAllDone && actions.length === 0) {
      actions.push({
        key: 'invite_staff',
        titleKey: 'pages.onboarding.recommendations.inviteStaff.title',
        hintKey: 'pages.onboarding.recommendations.inviteStaff.hint',
        to: '/app/settings',
      });
      actions.push({
        key: 'share_portal',
        titleKey: 'pages.onboarding.recommendations.sharePortal.title',
        hintKey: 'pages.onboarding.recommendations.sharePortal.hint',
        to: '/app/club-updates',
      });
    }

    return actions.slice(0, 5);
  }

  /**
   * Build the calm "first 30 days" companion strip. We deliberately keep
   * this lightweight: a short headline, a one-line subtitle, and at most
   * a few practical next moves the platform actually supports today.
   */
  private buildFirstThirtyDays(input: { readyForLaunch: boolean }): OnboardingFirstThirtyDays {
    const items: OnboardingFirstThirtyDaysItem[] = [
      {
        key: 'check_dashboard',
        titleKey: 'pages.onboarding.firstThirtyDays.items.checkDashboard.title',
        hintKey: 'pages.onboarding.firstThirtyDays.items.checkDashboard.hint',
        to: '/app/dashboard',
      },
      {
        key: 'invite_families',
        titleKey: 'pages.onboarding.firstThirtyDays.items.inviteFamilies.title',
        hintKey: 'pages.onboarding.firstThirtyDays.items.inviteFamilies.hint',
        to: '/app/guardians',
      },
      {
        key: 'first_charge_run',
        titleKey: 'pages.onboarding.firstThirtyDays.items.firstChargeRun.title',
        hintKey: 'pages.onboarding.firstThirtyDays.items.firstChargeRun.hint',
        to: '/app/finance',
      },
      {
        key: 'first_announcement',
        titleKey: 'pages.onboarding.firstThirtyDays.items.firstAnnouncement.title',
        hintKey: 'pages.onboarding.firstThirtyDays.items.firstAnnouncement.hint',
        to: '/app/club-updates',
      },
      {
        key: 'attendance_rhythm',
        titleKey: 'pages.onboarding.firstThirtyDays.items.attendanceRhythm.title',
        hintKey: 'pages.onboarding.firstThirtyDays.items.attendanceRhythm.hint',
        to: '/app/training',
      },
    ];

    return {
      state: input.readyForLaunch ? 'active' : 'dormant',
      headlineKey: input.readyForLaunch
        ? 'pages.onboarding.firstThirtyDays.headline.active'
        : 'pages.onboarding.firstThirtyDays.headline.dormant',
      subtitleKey: input.readyForLaunch
        ? 'pages.onboarding.firstThirtyDays.subtitle.active'
        : 'pages.onboarding.firstThirtyDays.subtitle.dormant',
      items,
    };
  }
}

/**
 * Calm "what could you safely do next with this batch?" hint. We deliberately
 * never speak in audit-log terms (no "rollback", no "undo"). The wizard is
 * honest about what each tone means: clean batches simply confirm what
 * landed, partial batches confirm what was already on file, and batches
 * that "need attention" carry a gentle invitation to re-run with a
 * corrected file.
 */
function buildReplayHint(batch: ImportBatch): { key: string; retryRecommended: boolean } {
  if (batch.status === 'needs_attention' || batch.rejectedRows > 0) {
    return {
      key: 'pages.onboarding.history.replay.needsAttention',
      retryRecommended: true,
    };
  }
  if (batch.warningRows > 0) {
    return {
      key: 'pages.onboarding.history.replay.warnings',
      retryRecommended: true,
    };
  }
  if (batch.status === 'partial') {
    return {
      key: 'pages.onboarding.history.replay.partial',
      retryRecommended: false,
    };
  }
  return {
    key: 'pages.onboarding.history.replay.success',
    retryRecommended: false,
  };
}

/**
 * Parse the small `summary` JSON blob we attach to each batch on commit.
 * Returns up to 6 short hint lines so the batch detail drawer can show the
 * same supportive guidance we offered at preview time.
 */
function parseSummaryHints(summary: string | null | undefined): string[] {
  if (!summary) return [];
  try {
    const parsed = JSON.parse(summary) as { hints?: unknown };
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.hints)) return [];
    return parsed.hints
      .filter((hint): hint is string => typeof hint === 'string')
      .map((hint) => hint.trim())
      .filter((hint) => hint.length > 0)
      .slice(0, 6);
  } catch {
    return [];
  }
}
