import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Athlete } from '../../database/entities/athlete.entity';
import { AthleteGuardian } from '../../database/entities/athlete-guardian.entity';
import { ChargeItem } from '../../database/entities/charge-item.entity';
import { ClubGroup } from '../../database/entities/club-group.entity';
import { Coach } from '../../database/entities/coach.entity';
import { Guardian } from '../../database/entities/guardian.entity';
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

export interface OnboardingStateReport {
  tenantId: string;
  tenantName: string;
  brandConfigured: boolean;
  steps: OnboardingStepReport[];
  progress: OnboardingProgress;
  /** First step the wizard would invite the user to act on. */
  nextStepKey: string | null;
  generatedAt: string;
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
    ]);

    const brandConfigured = Boolean(
      tenant.brandDisplayName ||
        tenant.brandTagline ||
        tenant.brandPrimaryColor ||
        tenant.brandLogoUrl ||
        tenant.brandLogoAssetFileName,
    );

    const blockedBy = (count: number, dep: string) => (count > 0 ? [] : [dep]);

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
      },
    ];

    // Mark the go-live step depending on completion of required steps.
    const requiredSteps = steps.filter((step) => !step.optional && step.key !== 'go_live');
    const requiredCompleted = requiredSteps.filter((step) => step.status === 'completed').length;
    const goLive = steps.find((s) => s.key === 'go_live')!;
    if (requiredCompleted === requiredSteps.length) {
      goLive.status = 'in_progress';
    }

    // Surface "needs_attention" when a step is blocked by a missing prereq.
    for (const step of steps) {
      if (step.blocked && step.status === 'not_started') {
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
      generatedAt: new Date().toISOString(),
    };
  }
}
