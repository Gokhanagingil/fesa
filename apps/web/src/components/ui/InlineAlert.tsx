import clsx from 'clsx';
import type { ReactNode } from 'react';

type InlineAlertProps = {
  tone?: 'success' | 'error' | 'info';
  children: ReactNode;
  message?: string;
  className?: string;
};

export function InlineAlert({ tone = 'info', children, message, className }: InlineAlertProps) {
  return (
    <div
      className={clsx(
        'rounded-xl border px-3 py-2 text-sm',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
        tone === 'error' && 'border-red-200 bg-red-50 text-red-700',
        tone === 'info' && 'border-amateur-border bg-amateur-canvas text-amateur-muted',
        className,
      )}
    >
      {children ?? message}
    </div>
  );
}
