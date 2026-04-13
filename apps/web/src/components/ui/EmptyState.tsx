import { useTranslation } from 'react-i18next';

type EmptyStateProps = {
  title?: string;
  hint?: string;
};

export function EmptyState({ title, hint }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-amateur-border bg-amateur-canvas/60 px-6 py-14 text-center">
      <p className="font-medium text-amateur-ink">{title ?? t('app.states.empty')}</p>
      <p className="mt-2 max-w-md text-sm text-amateur-muted">{hint ?? t('app.states.emptyHint')}</p>
    </div>
  );
}
