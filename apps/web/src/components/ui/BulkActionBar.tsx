import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

export interface BulkActionDescriptor {
  id: string;
  label: ReactNode;
  /** Optional helper text shown beneath the button when active. */
  hint?: ReactNode;
  /** When true the button is rendered as a quiet ghost variant. */
  ghost?: boolean;
  /** Disables this action even when something is selected. */
  disabled?: boolean;
  /** Confirm prompt before invoking the action. */
  confirm?: string;
  onClick: () => void | Promise<void>;
}

export interface BulkActionBarProps {
  selectedCount: number;
  visibleTotal: number;
  /** True when every visible row is in the selection. */
  allVisibleSelected: boolean;
  onToggleVisible: () => void;
  onClearSelection: () => void;
  actions?: BulkActionDescriptor[];
  /** Optional extra slot rendered to the right of the action buttons. */
  extra?: ReactNode;
  busy?: boolean;
  /** Optional title override. */
  title?: ReactNode;
  /** Optional subtitle override. */
  subtitle?: ReactNode;
}

/**
 * Reusable, calm bulk-action bar used across athletes / guardians / inventory.
 * Stays compact when nothing is selected; expands with action buttons once the
 * staff member starts a selection. Designed to feel warm, not enterprise-y.
 */
export function BulkActionBar({
  selectedCount,
  visibleTotal,
  allVisibleSelected,
  onToggleVisible,
  onClearSelection,
  actions = [],
  extra,
  busy = false,
  title,
  subtitle,
}: BulkActionBarProps) {
  const { t } = useTranslation();
  const hasSelection = selectedCount > 0;

  return (
    <section
      className={`rounded-2xl border bg-amateur-canvas p-4 transition-colors ${
        hasSelection ? 'border-amateur-accent shadow-sm' : 'border-amateur-border'
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-amateur-ink">
            {title ?? t('app.bulk.actionsTitle')}
          </p>
          <p className="mt-1 text-xs text-amateur-muted">
            {hasSelection
              ? t('app.bulk.selectedCount', { count: selectedCount })
              : (subtitle ?? t('app.bulk.actionsHint'))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleVisible}
            disabled={visibleTotal === 0 || busy}
          >
            {allVisibleSelected ? t('app.bulk.deselectVisible') : t('app.bulk.selectVisible')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onClearSelection}
            disabled={!hasSelection || busy}
          >
            {t('app.bulk.clearSelection')}
          </Button>
        </div>
      </div>
      {hasSelection && actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {actions.map((action) => (
            <Button
              key={action.id}
              type="button"
              variant={action.ghost ? 'ghost' : 'primary'}
              onClick={() => {
                if (action.confirm && !window.confirm(action.confirm)) return;
                void action.onClick();
              }}
              disabled={busy || action.disabled}
            >
              {action.label}
            </Button>
          ))}
          {extra ? <div className="ml-auto">{extra}</div> : null}
        </div>
      ) : extra ? (
        <div className="mt-3">{extra}</div>
      ) : null}
    </section>
  );
}
