import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchStarterViews } from '../../lib/reporting-client';
import type { ReportEntityKey, StarterReportView } from '../../lib/reporting-types';
import { Button } from '../ui/Button';

type Props = {
  /** Optional entity filter — when set, only matching starter views are listed. */
  entity?: ReportEntityKey;
  /** Optional title override; defaults to the i18n string. */
  title?: string;
  /** Optional helper subtitle override. */
  subtitle?: string;
  /** Show the management-pack subset only. */
  managementOnly?: boolean;
  /** Compact card UI for narrow spaces (e.g. dashboard sidebar). */
  compact?: boolean;
  /** Called when the user picks a starter to apply. */
  onApply: (view: StarterReportView) => void;
};

/**
 * Curated starter-report panel.
 *
 * This is the primary way the v2 report experience escapes the "blank canvas"
 * feeling. It lists predefined, deterministic, tenant-safe reports that the
 * user can open with one click and then duplicate/save as their own view.
 */
export function StarterViewsPanel({
  entity,
  title,
  subtitle,
  managementOnly,
  compact,
  onApply,
}: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<StarterReportView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchStarterViews();
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'starter-views error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!items) return null;
    let next = items;
    if (entity) next = next.filter((view) => view.entity === entity);
    if (managementOnly) next = next.filter((view) => view.managementPack);
    if (activeCategory) next = next.filter((view) => view.categoryKey === activeCategory);
    return next;
  }, [items, entity, managementOnly, activeCategory]);

  const categories = useMemo(() => {
    if (!items) return [] as { key: string; fallback: string }[];
    const seen = new Map<string, string>();
    const scope = entity ? items.filter((view) => view.entity === entity) : items;
    for (const view of scope) {
      if (managementOnly && !view.managementPack) continue;
      if (!seen.has(view.categoryKey)) seen.set(view.categoryKey, view.category);
    }
    return Array.from(seen.entries()).map(([key, fallback]) => ({ key, fallback }));
  }, [items, entity, managementOnly]);

  if (error) {
    return (
      <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4 text-sm text-amateur-muted">
        {error}
      </div>
    );
  }
  if (!filtered) {
    return (
      <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4 text-sm text-amateur-muted">
        {t('app.states.loading')}
      </div>
    );
  }
  if (filtered.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amateur-accent">
            {t('pages.reports.starter.eyebrow')}
          </p>
          <h3 className="mt-1 font-display text-base font-semibold text-amateur-ink">
            {title ?? t('pages.reports.starter.panelTitle')}
          </h3>
          <p className="mt-1 text-sm text-amateur-muted">
            {subtitle ?? t('pages.reports.starter.panelSubtitle')}
          </p>
        </div>
        {categories.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={`rounded-full border px-3 py-1 text-xs ${
                activeCategory === null
                  ? 'border-amateur-accent bg-amateur-accent text-white'
                  : 'border-amateur-border text-amateur-ink hover:bg-amateur-surface'
              }`}
            >
              {t('pages.reports.starter.all')}
            </button>
            {categories.map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveCategory(category.key)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  activeCategory === category.key
                    ? 'border-amateur-accent bg-amateur-accent text-white'
                    : 'border-amateur-border text-amateur-ink hover:bg-amateur-surface'
                }`}
              >
                {t(category.key, category.fallback)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`mt-4 grid gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3'}`}>
        {filtered.map((view) => (
          <article
            key={view.id}
            className="flex h-full flex-col justify-between rounded-2xl border border-amateur-border bg-amateur-surface px-4 py-4 shadow-sm transition hover:border-amateur-accent/40"
          >
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-amateur-muted">
                <span>{t(view.categoryKey, view.category)}</span>
                {view.groupBy ? (
                  <span className="rounded-full border border-amateur-border bg-amateur-canvas px-2 py-0.5 text-[10px] font-semibold text-amateur-accent">
                    {t('pages.reports.starter.groupedBadge')}
                  </span>
                ) : null}
              </div>
              <h4 className="mt-2 font-display text-sm font-semibold text-amateur-ink">
                {t(view.titleKey, view.id)}
              </h4>
              <p className="mt-1 text-xs text-amateur-muted">
                {t(view.descriptionKey, '')}
              </p>
            </div>
            <div className="mt-3 flex items-center justify-end">
              <Button type="button" variant="ghost" onClick={() => onApply(view)}>
                {t('pages.reports.starter.open')}
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
