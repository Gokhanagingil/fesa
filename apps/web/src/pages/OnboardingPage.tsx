import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { ImportFlow } from '../components/onboarding/ImportFlow';
import { useTenant } from '../lib/tenant-hooks';
import {
  ImportBatchStatus,
  ImportEntityDefinition,
  OnboardingHistoryEntry,
  OnboardingReadiness,
  OnboardingReadinessSignal,
  OnboardingStateReport,
  OnboardingStepLastImport,
  OnboardingStepReport,
  OnboardingStepStatus,
  fetchImportDefinitions,
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

const QUICK_LINKS = [
  { to: '/app/dashboard', key: 'dashboard' as const },
  { to: '/app/athletes', key: 'athletes' as const },
  { to: '/app/groups', key: 'groups' as const },
  { to: '/app/finance', key: 'finance' as const },
  { to: '/app/settings', key: 'settings' as const },
];

export function OnboardingPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [definitions, setDefinitions] = useState<ImportEntityDefinition[]>([]);
  const [state, setState] = useState<OnboardingStateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    (key: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('step', key);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

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
        <aside className="rounded-2xl border border-amateur-border bg-amateur-surface p-3 shadow-sm">
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
            />
          ) : null}
        </div>
      </div>
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
  onSelectStep: (key: string) => void;
}

function StepPanel({ state, step, definition, onCommitted, onSelectStep }: StepPanelProps) {
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
        <GoLiveReviewPanel state={state} onSelectStep={onSelectStep} />
      ) : null}

      {definition ? (
        <ImportFlow
          key={definition.entity}
          definition={definition}
          onCommitted={onCommitted}
          showDefaultBranchPicker={definition.entity === 'athletes'}
          lastImportSummary={
            step.lastImport ? <LastImportCard lastImport={step.lastImport} /> : null
          }
        />
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
}: {
  state: OnboardingStateReport;
  onSelectStep: (key: string) => void;
}) {
  const { t } = useTranslation();
  const { readiness } = state;
  return (
    <div className="space-y-5">
      <ReadinessSummary readiness={readiness} />

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

      <RecentImportsStrip recent={state.recentImports} />

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

function RecentImportsStrip({ recent }: { recent: OnboardingHistoryEntry[] }) {
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
              {entry.rejectedRows > 0 || entry.warningRows > 0 ? (
                <p className="mt-1 text-[11px] text-amber-700">
                  {t('pages.onboarding.history.attention', {
                    rejected: entry.rejectedRows,
                    warnings: entry.warningRows,
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LastImportCard({ lastImport }: { lastImport: OnboardingStepLastImport }): ReactNode {
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
    </section>
  );
}

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
