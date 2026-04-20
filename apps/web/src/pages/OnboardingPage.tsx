import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { ImportFlow } from '../components/onboarding/ImportFlow';
import { useTenant } from '../lib/tenant-hooks';
import {
  ImportBatchStatus,
  ImportEntityDefinition,
  OnboardingBatchDetail,
  OnboardingFirstThirtyDays,
  OnboardingHistoryEntry,
  OnboardingReadiness,
  OnboardingReadinessSignal,
  OnboardingRecommendedAction,
  OnboardingStateReport,
  OnboardingStepLastImport,
  OnboardingStepReport,
  OnboardingStepStatus,
  fetchImportDefinitions,
  fetchOnboardingBatch,
  fetchOnboardingHistory,
  fetchOnboardingState,
} from '../lib/imports';

const STATUS_TONES: Record<OnboardingStepStatus, string> = {
  not_started: 'bg-amateur-canvas text-amateur-muted',
  in_progress: 'bg-sky-100 text-sky-800',
  completed: 'bg-emerald-100 text-emerald-800',
  needs_attention: 'bg-amber-100 text-amber-800',
};

const STEP_DOT_TONES: Record<OnboardingStepStatus, string> = {
  not_started: 'bg-amateur-border',
  in_progress: 'bg-sky-500',
  completed: 'bg-emerald-500',
  needs_attention: 'bg-amber-500',
};

const BATCH_STATUS_TONES: Record<ImportBatchStatus, string> = {
  success: 'bg-emerald-100 text-emerald-800',
  partial: 'bg-sky-100 text-sky-800',
  needs_attention: 'bg-amber-100 text-amber-800',
};

const READINESS_TONES: Record<OnboardingReadiness['tone'], string> = {
  fresh: 'border-amateur-border bg-amateur-canvas text-amateur-ink',
  in_progress: 'border-sky-200 bg-sky-50 text-sky-900',
  almost_ready: 'border-amber-200 bg-amber-50 text-amber-900',
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

const SIGNAL_TONES: Record<OnboardingReadinessSignal['tone'], string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
};

type CompletionTone = 'needs_attention' | 'almost_ready' | 'ready';

const COMPLETION_TONES: Record<CompletionTone, string> = {
  needs_attention: 'border-amber-200 bg-amber-50 text-amber-900',
  almost_ready: 'border-sky-200 bg-sky-50 text-sky-900',
  ready: 'border-emerald-200 bg-emerald-50 text-emerald-900',
};

const QUICK_LINKS = [
  { to: '/app/dashboard', key: 'dashboard' as const },
  { to: '/app/athletes', key: 'athletes' as const },
  { to: '/app/groups', key: 'groups' as const },
  { to: '/app/finance', key: 'finance' as const },
  { to: '/app/settings', key: 'settings' as const },
];

const ENTITY_TO_STEP_KEY: Record<string, string> = {
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

function entityToStepKey(entity: string): string {
  return ENTITY_TO_STEP_KEY[entity] ?? entity;
}

function deriveCompletionTone(state: OnboardingStateReport): CompletionTone {
  const requiredSteps = state.steps.filter((step) => !step.optional && step.key !== 'go_live');
  const requiredAllDone = requiredSteps.every((step) => step.status === 'completed');
  const hasNeedsAttention = state.steps.some((step) => step.status === 'needs_attention');
  if (!requiredAllDone || hasNeedsAttention) return 'needs_attention';
  return state.readiness.tone === 'ready' ? 'ready' : 'almost_ready';
}

export function OnboardingPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [definitions, setDefinitions] = useState<ImportEntityDefinition[]>([]);
  const [state, setState] = useState<OnboardingStateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerBatchId, setDrawerBatchId] = useState<string | null>(null);
  const [stepHistoryFor, setStepHistoryFor] = useState<string | null>(null);
  const tryAgainScrollRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [defs, stateResp] = await Promise.all([
        fetchImportDefinitions(),
        fetchOnboardingState(),
      ]);
      setDefinitions(defs);
      setState(stateResp);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('pages.onboarding.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [tenantId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeStepKey = useMemo(() => {
    const candidate = searchParams.get('step');
    const known = state?.steps.find((step) => step.key === candidate);
    if (known) return known.key;
    return state?.nextStepKey ?? state?.steps[0]?.key ?? null;
  }, [searchParams, state]);

  const activeStep = useMemo(
    () => state?.steps.find((step) => step.key === activeStepKey) ?? null,
    [state, activeStepKey],
  );

  const activeDefinition = useMemo(() => {
    if (!activeStep?.importEntity) return null;
    return definitions.find((entry) => entry.entity === activeStep.importEntity) ?? null;
  }, [activeStep, definitions]);

  const setStep = useCallback(
    (key: string, options: { tryAgain?: boolean } = {}) => {
      const next = new URLSearchParams(searchParams);
      next.set('step', key);
      if (options.tryAgain) {
        tryAgainScrollRef.current = true;
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!tryAgainScrollRef.current || !activeStep?.importEntity) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById('onboarding-import-flow');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      tryAgainScrollRef.current = false;
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeStep?.importEntity, activeStepKey]);

  const handleCommitted = () => {
    void refresh();
  };

  if (!tenantId && !tenantLoading) {
    return (
      <div>
        <PageHeader title={t('pages.onboarding.title')} subtitle={t('pages.onboarding.subtitle')} />
        <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('pages.onboarding.title')}
        subtitle={t('pages.onboarding.subtitle')}
        actions={
          <Link
            to="/app/imports"
            className="inline-flex items-center justify-center rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm font-semibold text-amateur-ink hover:bg-amateur-surface"
          >
            {t('pages.onboarding.openClassicImports')}
          </Link>
        }
      />

      {error ? (
        <InlineAlert tone="error" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}

      {state ? <ProgressBanner state={state} /> : null}

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-amateur-border bg-amateur-surface p-3 shadow-sm lg:sticky lg:top-4 lg:self-start">
          <p className="px-2 py-2 font-display text-sm font-semibold text-amateur-ink">
            {t('pages.onboarding.stepsTitle')}
          </p>
          <ol className="space-y-1">
            {state?.steps.map((step, index) => (
              <li key={step.key}>
                <button
                  type="button"
                  onClick={() => setStep(step.key)}
                  className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    activeStepKey === step.key
                      ? 'bg-amateur-accent-soft text-amateur-ink'
                      : 'hover:bg-amateur-canvas text-amateur-muted'
                  }`}
                >
                  <span
                    className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${STEP_DOT_TONES[step.status]}`}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
                      {t('pages.onboarding.stepNumber', { index: index + 1 })}
                      {step.optional ? ` · ${t('pages.onboarding.optional')}` : ''}
                    </span>
                    <span className="block font-medium text-amateur-ink">{t(step.titleKey)}</span>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_TONES[step.status]}`}
                    >
                      {t(`pages.onboarding.status.${step.status}`)}
                    </span>
                    {step.lastImport ? (
                      <span className="mt-1 block text-[10px] text-amateur-muted">
                        {t('pages.onboarding.rail.lastImportedAt', {
                          when: formatRelative(step.lastImport.committedAt, t),
                        })}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <div className="min-w-0">
          {loading && !state ? (
            <p className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 text-sm text-amateur-muted shadow-sm">
              {t('pages.onboarding.loading')}
            </p>
          ) : null}
          {activeStep && state ? (
            <StepPanel
              state={state}
              step={activeStep}
              definition={activeDefinition}
              onCommitted={handleCommitted}
              onSelectStep={setStep}
              onOpenBatch={(batchId) => setDrawerBatchId(batchId)}
              onOpenStepHistory={(stepKey) => setStepHistoryFor(stepKey)}
            />
          ) : null}
        </div>
      </div>

      {drawerBatchId ? (
        <BatchDrawer batchId={drawerBatchId} onClose={() => setDrawerBatchId(null)} />
      ) : null}
      {stepHistoryFor ? (
        <StepHistoryDrawer
          stepKey={stepHistoryFor}
          onClose={() => setStepHistoryFor(null)}
          onOpenBatch={(batchId) => {
            setStepHistoryFor(null);
            setDrawerBatchId(batchId);
          }}
        />
      ) : null}
    </div>
  );
}

function ProgressBanner({ state }: { state: OnboardingStateReport }) {
  const { t } = useTranslation();
  const pct = state.progress.requiredTotal
    ? Math.round((state.progress.requiredCompleted / state.progress.requiredTotal) * 100)
    : 0;
  const stateLabel = t(`pages.onboarding.progress.${state.progress.state}`);
  return (
    <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-base font-semibold text-amateur-ink">
            {t('pages.onboarding.greeting', { name: state.tenantName })}
          </p>
          <p className="mt-1 text-sm text-amateur-muted">
            {t('pages.onboarding.progressLine', {
              done: state.progress.requiredCompleted,
              total: state.progress.requiredTotal,
            })}
          </p>
        </div>
        <span className="inline-flex rounded-full bg-amateur-accent-soft px-3 py-1 text-xs font-semibold text-amateur-accent">
          {stateLabel}
        </span>
      </div>
      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-amateur-canvas"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('pages.onboarding.progressLabel')}
      >
        <div
          className="h-full rounded-full bg-amateur-accent transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}

interface StepPanelProps {
  state: OnboardingStateReport;
  step: OnboardingStepReport;
  definition: ImportEntityDefinition | null;
  onCommitted: () => void;
  onSelectStep: (key: string, options?: { tryAgain?: boolean }) => void;
  onOpenBatch: (batchId: string) => void;
  onOpenStepHistory: (stepKey: string) => void;
}

function StepPanel({
  state,
  step,
  definition,
  onCommitted,
  onSelectStep,
  onOpenBatch,
  onOpenStepHistory,
}: StepPanelProps) {
  const { t } = useTranslation();
  const isClubBasics = step.key === 'club_basics';
  const isGoLive = step.key === 'go_live';

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
          {t(`pages.onboarding.status.${step.status}`)}
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold text-amateur-ink">
          {t(step.titleKey)}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-amateur-muted">{t(step.hintKey)}</p>
        {step.count > 0 ? (
          <p className="mt-3 text-xs text-amateur-muted">
            {t('pages.onboarding.alreadyHave', { count: step.count })}
          </p>
        ) : null}
        {step.blocked && step.blockedBy.length > 0 ? (
          <InlineAlert tone="warning" className="mt-3">
            {t('pages.onboarding.blocked', {
              steps: step.blockedBy
                .map((key) => t(`pages.onboarding.steps.${key}.title`))
                .join(', '),
            })}
          </InlineAlert>
        ) : null}
      </header>

      {isClubBasics ? <ClubBasicsPanel done={step.status === 'completed'} /> : null}

      {isGoLive ? (
        <GoLiveReviewPanel
          state={state}
          onSelectStep={onSelectStep}
          onOpenBatch={onOpenBatch}
        />
      ) : null}

      {definition ? (
        <div id="onboarding-import-flow">
          <ImportFlow
            key={definition.entity}
            definition={definition}
            onCommitted={onCommitted}
            showDefaultBranchPicker={definition.entity === 'athletes'}
            lastImportSummary={
              step.lastImport ? (
                <LastImportCard
                  step={step}
                  lastImport={step.lastImport}
                  onOpenBatch={onOpenBatch}
                  onTryAgain={() => onSelectStep(step.key, { tryAgain: true })}
                  onViewAll={() => onOpenStepHistory(step.key)}
                />
              ) : null
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function ClubBasicsPanel({ done }: { done: boolean }) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
      <p className="font-display text-sm font-semibold text-amateur-ink">
        {t('pages.onboarding.clubBasics.title')}
      </p>
      <p className="mt-1 text-sm text-amateur-muted">{t('pages.onboarding.clubBasics.hint')}</p>
      <ul className="mt-3 space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-700">
            ✓
          </span>
          {t('pages.onboarding.clubBasics.bulletAccount')}
        </li>
        <li className="flex items-start gap-2">
          <span
            className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
              done ? 'bg-emerald-100 text-emerald-700' : 'bg-amateur-canvas text-amateur-muted'
            }`}
          >
            {done ? '✓' : '·'}
          </span>
          {t('pages.onboarding.clubBasics.bulletBranding')}
        </li>
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/app/settings"
          className="inline-flex items-center justify-center rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm font-semibold text-amateur-ink hover:bg-amateur-surface"
        >
          {t('pages.onboarding.clubBasics.openSettings')}
        </Link>
      </div>
    </section>
  );
}

function GoLiveReviewPanel({
  state,
  onSelectStep,
  onOpenBatch,
}: {
  state: OnboardingStateReport;
  onSelectStep: (key: string) => void;
  onOpenBatch: (batchId: string) => void;
}) {
  const { t } = useTranslation();
  const { readiness, recommendedActions, firstThirtyDays } = state;
  const completionTone = deriveCompletionTone(state);
  return (
    <div className="space-y-5">
      <CompletionPanel state={state} tone={completionTone} />

      <ReadinessSummary readiness={readiness} />

      <RecommendedActionsPanel
        actions={recommendedActions}
        onSelectStep={onSelectStep}
      />

      <ReadinessChecklist
        title={t('pages.onboarding.goLive.requiredTitle')}
        emptyHint={t('pages.onboarding.goLive.requiredEmpty')}
        steps={state.steps.filter((step) => !step.optional && step.key !== 'go_live')}
        onSelectStep={onSelectStep}
      />

      <ReadinessChecklist
        title={t('pages.onboarding.goLive.optionalTitle')}
        emptyHint={t('pages.onboarding.goLive.optionalEmpty')}
        steps={state.steps.filter((step) => step.optional)}
        onSelectStep={onSelectStep}
      />

      <RecentImportsStrip recent={state.recentImports} onOpenBatch={onOpenBatch} />

      <FirstThirtyDaysPanel first30={firstThirtyDays} onSelectStep={onSelectStep} />

      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <p className="font-display text-sm font-semibold text-amateur-ink">
          {t('pages.onboarding.goLive.nextStepsTitle')}
        </p>
        <p className="mt-1 text-sm text-amateur-muted">
          {t('pages.onboarding.goLive.nextStepsHint')}
        </p>
        <ul className="mt-3 space-y-1 text-sm text-amateur-muted">
          <li>{t('pages.onboarding.goLive.bulletReview')}</li>
          <li>{t('pages.onboarding.goLive.bulletInvite')}</li>
          <li>{t('pages.onboarding.goLive.bulletCommunicate')}</li>
        </ul>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm font-semibold text-amateur-ink hover:bg-amateur-surface"
            >
              {t(`pages.onboarding.goLive.links.${link.key}`)}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function CompletionPanel({
  state,
  tone,
}: {
  state: OnboardingStateReport;
  tone: CompletionTone;
}) {
  const { t } = useTranslation();
  const pct = state.progress.requiredTotal
    ? Math.round((state.progress.requiredCompleted / state.progress.requiredTotal) * 100)
    : 0;
  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${COMPLETION_TONES[tone]}`}
      aria-label={t('pages.onboarding.goLive.completionTitle')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
            {t('pages.onboarding.goLive.completionTitle')}
          </p>
          <h3 className="mt-1 font-display text-lg font-semibold">
            {t(`pages.onboarding.goLive.completionState.${tone}`)}
          </h3>
          <p className="mt-1 max-w-3xl text-sm opacity-90">
            {t(`pages.onboarding.goLive.completionHint.${tone}`)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-semibold">
            {state.progress.requiredCompleted}/{state.progress.requiredTotal}
          </p>
          <p className="text-[11px] uppercase tracking-wide opacity-70">{pct}%</p>
        </div>
      </div>
    </section>
  );
}

function RecommendedActionsPanel({
  actions,
  onSelectStep,
}: {
  actions: OnboardingRecommendedAction[];
  onSelectStep: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
      <p className="font-display text-sm font-semibold text-amateur-ink">
        {t('pages.onboarding.recommendations.title')}
      </p>
      <p className="mt-1 text-sm text-amateur-muted">
        {t('pages.onboarding.recommendations.hint')}
      </p>
      {actions.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas px-3 py-4 text-sm text-amateur-muted">
          {t('pages.onboarding.recommendations.empty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {actions.map((action) => (
            <li
              key={action.key}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-amateur-border/60 bg-amateur-canvas px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-amateur-ink">{t(action.titleKey)}</p>
                <p className="mt-0.5 text-xs text-amateur-muted">{t(action.hintKey)}</p>
              </div>
              {action.stepKey ? (
                <button
                  type="button"
                  onClick={() => onSelectStep(action.stepKey!)}
                  className="rounded-xl border border-amateur-border bg-white px-3 py-1 text-xs font-semibold text-amateur-ink hover:bg-amateur-surface"
                >
                  {t('pages.onboarding.recommendations.open')}
                </button>
              ) : action.to ? (
                <Link
                  to={action.to}
                  className="rounded-xl border border-amateur-border bg-white px-3 py-1 text-xs font-semibold text-amateur-ink hover:bg-amateur-surface"
                >
                  {t('pages.onboarding.recommendations.open')}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FirstThirtyDaysPanel({
  first30,
  onSelectStep,
}: {
  first30: OnboardingFirstThirtyDays;
  onSelectStep: (key: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${
        first30.state === 'active'
          ? 'border-emerald-200 bg-emerald-50/60'
          : 'border-amateur-border bg-amateur-surface'
      }`}
      aria-label={t('pages.onboarding.firstThirtyDays.title')}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
        {t('pages.onboarding.firstThirtyDays.title')}
      </p>
      <h3 className="mt-1 font-display text-base font-semibold text-amateur-ink">
        {t(first30.headlineKey)}
      </h3>
      <p className="mt-1 text-sm text-amateur-muted">{t(first30.subtitleKey)}</p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2">
        {first30.items.map((item, index) => {
          const content = (
            <>
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amateur-accent-soft text-[11px] font-semibold text-amateur-accent"
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-amateur-ink">{t(item.titleKey)}</span>
                <span className="mt-0.5 block text-xs text-amateur-muted">{t(item.hintKey)}</span>
              </span>
            </>
          );
          const className =
            'flex items-start gap-3 rounded-xl border border-amateur-border/60 bg-white px-3 py-2 text-left transition-colors hover:bg-amateur-canvas';
          return (
            <li key={item.key}>
              {item.stepKey ? (
                <button
                  type="button"
                  className={`w-full ${className}`}
                  onClick={() => onSelectStep(item.stepKey!)}
                >
                  {content}
                </button>
              ) : item.to ? (
                <Link className={className} to={item.to}>
                  {content}
                </Link>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ReadinessSummary({ readiness }: { readiness: OnboardingReadiness }) {
  const { t } = useTranslation();
  return (
    <section
      className={`rounded-2xl border p-5 shadow-sm ${READINESS_TONES[readiness.tone]}`}
      aria-label={t('pages.onboarding.readiness.ariaLabel')}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
        {t(`pages.onboarding.readiness.tone.${readiness.tone}`)}
      </p>
      <h3 className="mt-1 font-display text-lg font-semibold">{t(readiness.headlineKey)}</h3>
      <p className="mt-1 text-sm opacity-90">{t(readiness.subtitleKey)}</p>
      {readiness.signals.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {readiness.signals.map((signal) => (
            <li
              key={signal.key}
              className={`rounded-xl border px-3 py-2 text-sm ${SIGNAL_TONES[signal.tone]}`}
            >
              {t(signal.messageKey, signal.values ?? {})}
              {signal.stepKey ? (
                <>
                  {' '}
                  <span className="text-xs opacity-80">
                    ({t(`pages.onboarding.steps.${signal.stepKey}.title`)})
                  </span>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs opacity-80">{t('pages.onboarding.readiness.noSignals')}</p>
      )}
    </section>
  );
}

function ReadinessChecklist({
  title,
  emptyHint,
  steps,
  onSelectStep,
}: {
  title: string;
  emptyHint: string;
  steps: OnboardingStepReport[];
  onSelectStep: (key: string) => void;
}) {
  const { t } = useTranslation();
  if (steps.length === 0) return null;
  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
      <p className="font-display text-sm font-semibold text-amateur-ink">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {steps.map((step) => {
          const tone = STATUS_TONES[step.status];
          return (
            <li
              key={step.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amateur-border/60 bg-amateur-canvas px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-full ${STEP_DOT_TONES[step.status]}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="truncate font-medium text-amateur-ink">{t(step.titleKey)}</p>
                  <p className="text-[11px] text-amateur-muted">
                    {step.lastImport
                      ? t('pages.onboarding.goLive.lastImportedLine', {
                          when: formatRelative(step.lastImport.committedAt, t),
                          who: step.lastImport.triggeredBy ?? t('pages.onboarding.goLive.someone'),
                        })
                      : step.count > 0
                        ? t('pages.onboarding.goLive.recordsOnFile', { count: step.count })
                        : t('pages.onboarding.goLive.notTouchedYet')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`}
                >
                  {t(`pages.onboarding.status.${step.status}`)}
                </span>
                <button
                  type="button"
                  onClick={() => onSelectStep(step.key)}
                  className="rounded-xl border border-amateur-border bg-white px-3 py-1 text-xs font-semibold text-amateur-ink hover:bg-amateur-surface"
                >
                  {t('pages.onboarding.goLive.openStep')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-amateur-muted">{emptyHint}</p>
    </section>
  );
}

function RecentImportsStrip({
  recent,
  onOpenBatch,
}: {
  recent: OnboardingHistoryEntry[];
  onOpenBatch: (batchId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const fmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }),
    [i18n.language],
  );
  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold text-amateur-ink">
            {t('pages.onboarding.history.title')}
          </p>
          <p className="mt-1 text-sm text-amateur-muted">{t('pages.onboarding.history.hint')}</p>
        </div>
      </div>
      {recent.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas px-3 py-4 text-sm text-amateur-muted">
          {t('pages.onboarding.history.empty')}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {recent.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-amateur-border/70 bg-amateur-canvas px-3 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-amateur-ink">
                  {t(`pages.onboarding.steps.${entityToStepKey(entry.entity)}.title`, {
                    defaultValue: entry.entity,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BATCH_STATUS_TONES[entry.status]}`}
                  >
                    {t(`pages.onboarding.history.status.${entry.status}`)}
                  </span>
                  <span className="text-xs text-amateur-muted">
                    {fmt.format(new Date(entry.committedAt))}
                  </span>
                </div>
              </div>
              <p className="mt-1 text-xs text-amateur-muted">
                {t('pages.onboarding.history.line', {
                  source: entry.source ?? t('pages.onboarding.history.sourceFallback'),
                  created: entry.createdRows,
                  updated: entry.updatedRows,
                  skipped: entry.skippedRows,
                })}
              </p>
              {entry.triggeredBy ? (
                <p className="mt-0.5 text-[11px] text-amateur-muted">
                  {t('pages.onboarding.history.triggeredBy', { who: entry.triggeredBy })}
                </p>
              ) : null}
              <p className="mt-1 text-[11px] text-amateur-muted">{t(entry.replayHintKey)}</p>
              {entry.rejectedRows > 0 || entry.warningRows > 0 ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  {t('pages.onboarding.history.attention', {
                    rejected: entry.rejectedRows,
                    warnings: entry.warningRows,
                  })}
                </p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onOpenBatch(entry.id)}
                  className="rounded-xl border border-amateur-border bg-white px-3 py-1 text-xs font-semibold text-amateur-ink hover:bg-amateur-surface"
                >
                  {t('pages.onboarding.history.openBatch')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LastImportCard({
  step,
  lastImport,
  onOpenBatch,
  onTryAgain,
  onViewAll,
}: {
  step: OnboardingStepReport;
  lastImport: OnboardingStepLastImport;
  onOpenBatch: (batchId: string) => void;
  onTryAgain: () => void;
  onViewAll: () => void;
}): ReactNode {
  const { t, i18n } = useTranslation();
  const fmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }),
    [i18n.language],
  );
  const showTryAgain =
    step.status === 'needs_attention' ||
    lastImport.rejectedRows > 0 ||
    lastImport.warningRows > 0 ||
    lastImport.status === 'needs_attention';
  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold text-amateur-ink">
            {t('pages.onboarding.lastImport.title')}
          </p>
          <p className="mt-1 text-sm text-amateur-muted">
            {t('pages.onboarding.lastImport.line', {
              when: fmt.format(new Date(lastImport.committedAt)),
              who: lastImport.triggeredBy ?? t('pages.onboarding.goLive.someone'),
              source: lastImport.source ?? t('pages.onboarding.history.sourceFallback'),
            })}
          </p>
          <p className="mt-1 text-xs text-amateur-muted">
            {t('pages.onboarding.lastImport.counts', {
              created: lastImport.createdRows,
              updated: lastImport.updatedRows,
              skipped: lastImport.skippedRows,
            })}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BATCH_STATUS_TONES[lastImport.status]}`}
        >
          {t(`pages.onboarding.history.status.${lastImport.status}`)}
        </span>
      </div>
      {lastImport.rejectedRows > 0 || lastImport.warningRows > 0 ? (
        <InlineAlert tone="warning" className="mt-3">
          {t('pages.onboarding.lastImport.attention', {
            rejected: lastImport.rejectedRows,
            warnings: lastImport.warningRows,
          })}
        </InlineAlert>
      ) : null}
      {showTryAgain ? (
        <p className="mt-3 text-xs text-amateur-muted">
          {t('pages.onboarding.lastImport.tryAgainHint')}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenBatch(lastImport.batchId)}
          className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-1.5 text-xs font-semibold text-amateur-ink hover:bg-amateur-surface"
        >
          {t('pages.onboarding.lastImport.openResult')}
        </button>
        <button
          type="button"
          onClick={onViewAll}
          className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-1.5 text-xs font-semibold text-amateur-ink hover:bg-amateur-surface"
        >
          {t('pages.onboarding.lastImport.viewAll')}
        </button>
        {showTryAgain ? (
          <button
            type="button"
            onClick={onTryAgain}
            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            {t('pages.onboarding.lastImport.tryAgain')}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function BatchDrawer({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [detail, setDetail] = useState<OnboardingBatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }),
    [i18n.language],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOnboardingBatch(batchId)
      .then((res) => {
        if (cancelled) return;
        setDetail(res);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, t]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-end bg-amateur-ink/30 p-2 sm:items-stretch sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('pages.onboarding.history.drawerTitle')}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
              {t('pages.onboarding.history.drawerTitle')}
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
              {detail
                ? t(`pages.onboarding.steps.${detail.stepKey}.title`, {
                    defaultValue: detail.entity,
                  })
                : t('pages.onboarding.history.drawerSubtitle')}
            </h3>
            {detail ? (
              <p className="mt-1 text-xs text-amateur-muted">
                {fmt.format(new Date(detail.committedAt))}
                {detail.triggeredBy
                  ? ` · ${t('pages.onboarding.history.triggeredBy', { who: detail.triggeredBy })}`
                  : ''}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-1.5 text-xs font-semibold text-amateur-ink hover:bg-amateur-surface"
          >
            {t('pages.onboarding.history.drawerClose')}
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-amateur-muted">{t('pages.onboarding.loading')}</p>
        ) : null}
        {error ? (
          <InlineAlert tone="error" className="mt-4">
            {error}
          </InlineAlert>
        ) : null}
        {detail ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BATCH_STATUS_TONES[detail.status]}`}
              >
                {t(`pages.onboarding.history.status.${detail.status}`)}
              </span>
              {detail.source ? (
                <span className="text-xs text-amateur-muted">{detail.source}</span>
              ) : null}
            </div>
            <p className="text-sm text-amateur-muted">
              {t('pages.onboarding.history.line', {
                source: detail.source ?? t('pages.onboarding.history.sourceFallback'),
                created: detail.createdRows,
                updated: detail.updatedRows,
                skipped: detail.skippedRows,
              })}
            </p>
            {detail.rejectedRows > 0 || detail.warningRows > 0 ? (
              <p className="text-xs text-amber-700">
                {t('pages.onboarding.history.attention', {
                  rejected: detail.rejectedRows,
                  warnings: detail.warningRows,
                })}
              </p>
            ) : null}
            <p className="text-xs text-amateur-muted">{t(detail.replayHintKey)}</p>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
                {t('pages.onboarding.history.drawerHints')}
              </p>
              {detail.hints.length === 0 ? (
                <p className="mt-2 text-xs text-amateur-muted">
                  {t('pages.onboarding.history.drawerNoHints')}
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-xs text-amateur-muted">
                  {detail.hints.map((hint, idx) => (
                    <li key={idx} className="rounded-xl bg-amateur-canvas px-3 py-1.5">
                      {hint}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StepHistoryDrawer({
  stepKey,
  onClose,
  onOpenBatch,
}: {
  stepKey: string;
  onClose: () => void;
  onOpenBatch: (batchId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<OnboardingHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fmt = useMemo(
    () => new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }),
    [i18n.language],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchOnboardingHistory({ step: stepKey, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        setItems(res);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stepKey, t]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-end bg-amateur-ink/30 p-2 sm:items-stretch sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('pages.onboarding.history.stepHistoryTitle')}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
              {t('pages.onboarding.history.stepHistoryTitle')}
            </p>
            <h3 className="mt-1 font-display text-lg font-semibold text-amateur-ink">
              {t(`pages.onboarding.steps.${stepKey}.title`, { defaultValue: stepKey })}
            </h3>
            <p className="mt-1 text-xs text-amateur-muted">
              {t('pages.onboarding.history.stepHistoryHint')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-1.5 text-xs font-semibold text-amateur-ink hover:bg-amateur-surface"
          >
            {t('pages.onboarding.history.drawerClose')}
          </button>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-amateur-muted">{t('pages.onboarding.loading')}</p>
        ) : null}
        {error ? (
          <InlineAlert tone="error" className="mt-4">
            {error}
          </InlineAlert>
        ) : null}
        {items && items.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-amateur-border bg-amateur-canvas px-3 py-4 text-sm text-amateur-muted">
            {t('pages.onboarding.history.stepHistoryEmpty')}
          </p>
        ) : null}
        {items && items.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {items.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-amateur-border/70 bg-amateur-canvas px-3 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BATCH_STATUS_TONES[entry.status]}`}
                  >
                    {t(`pages.onboarding.history.status.${entry.status}`)}
                  </span>
                  <span className="text-xs text-amateur-muted">
                    {fmt.format(new Date(entry.committedAt))}
                  </span>
                </div>
                <p className="mt-1 text-xs text-amateur-muted">
                  {t('pages.onboarding.history.line', {
                    source: entry.source ?? t('pages.onboarding.history.sourceFallback'),
                    created: entry.createdRows,
                    updated: entry.updatedRows,
                    skipped: entry.skippedRows,
                  })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenBatch(entry.id)}
                    className="rounded-xl border border-amateur-border bg-white px-3 py-1 text-xs font-semibold text-amateur-ink hover:bg-amateur-surface"
                  >
                    {t('pages.onboarding.history.openBatch')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function formatRelative(iso: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return t('pages.onboarding.relative.justNow');
  if (minutes < 60) return t('pages.onboarding.relative.minutesAgo', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('pages.onboarding.relative.hoursAgo', { count: hours });
  const days = Math.round(hours / 24);
  if (days < 14) return t('pages.onboarding.relative.daysAgo', { count: days });
  const weeks = Math.round(days / 7);
  return t('pages.onboarding.relative.weeksAgo', { count: weeks });
}
