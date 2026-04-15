import type { ChangeEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type ListPageFrameProps = {
  toolbar?: ReactNode;
  toolbarLabel?: string;
  children: ReactNode;
  /** When set, search is interactive; otherwise shows a read-only placeholder (shell demos). */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
  };
};

/**
 * Established pattern for export-ready lists: toolbar (search, filters, bulk) + content.
 */
export function ListPageFrame({ toolbar, toolbarLabel, children, search }: ListPageFrameProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-2xl border border-amateur-border bg-amateur-surface shadow-sm">
      <div className="border-b border-amateur-border p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-sm">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amateur-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="search"
            readOnly={!search}
            {...(search
              ? { value: search.value, onChange: (e: ChangeEvent<HTMLInputElement>) => search.onChange(e.target.value) }
              : {})}
            disabled={search?.disabled}
            placeholder={search?.placeholder ?? t('app.actions.search')}
            className="w-full rounded-xl border border-amateur-border bg-amateur-canvas py-2 pl-9 pr-3 text-sm text-amateur-ink outline-none ring-amateur-accent/20 placeholder:text-amateur-muted focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={t('app.actions.search')}
          />
        </div>
          {toolbar ? (
            <div className="space-y-2">
              {toolbarLabel ? (
                <p className="text-xs font-medium uppercase tracking-wide text-amateur-muted">
                  {toolbarLabel}
                </p>
              ) : null}
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">{toolbar}</div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
