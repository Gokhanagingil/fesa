import clsx from 'clsx';
import type { ReactNode } from 'react';

type StatusBadgeTone = 'default' | 'danger' | 'warning' | 'success' | 'info';

const toneClassNames: Record<StatusBadgeTone, string> = {
  default: 'bg-slate-100 text-slate-700',
  danger: 'bg-rose-100 text-rose-700',
  warning: 'bg-amber-100 text-amber-700',
  success: 'bg-emerald-100 text-emerald-700',
  info: 'bg-sky-100 text-sky-700',
};

type StatusBadgeProps = {
  label?: string;
  tone?: StatusBadgeTone;
  className?: string;
  children?: ReactNode;
};

export function StatusBadge({ label, tone = 'default', className, children }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium',
        toneClassNames[tone],
        className,
      )}
    >
      {children ?? label}
    </span>
  );
}
