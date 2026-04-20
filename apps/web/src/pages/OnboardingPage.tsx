import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { ImportFlow } from '../components/onboarding/ImportFlow';
import { useTenant } from '../lib/tenant-hooks';
import {
  ImportEntityDefinition,
  OnboardingStateReport,
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

  const setStep = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('step', key);
    setSearchParams(next, { replace: true });
  };

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
          {activeStep ? (
            <StepPanel
              step={activeStep}
              definition={activeDefinition}
              onCommitted={handleCommitted}
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
  step: OnboardingStepReport;
  definition: ImportEntityDefinition | null;
  onCommitted: () => void;
}

function StepPanel({ step, definition, onCommitted }: StepPanelProps) {
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

      {isGoLive ? <GoLivePanel /> : null}

      {definition ? (
        <ImportFlow
          key={definition.entity}
          definition={definition}
          onCommitted={onCommitted}
          showDefaultBranchPicker={definition.entity === 'athletes'}
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

function GoLivePanel() {
  const { t } = useTranslation();
  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
      <p className="font-display text-sm font-semibold text-amateur-ink">
        {t('pages.onboarding.goLive.title')}
      </p>
      <p className="mt-1 text-sm text-amateur-muted">{t('pages.onboarding.goLive.hint')}</p>
      <ul className="mt-4 space-y-2 text-sm text-amateur-muted">
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
  );
}
