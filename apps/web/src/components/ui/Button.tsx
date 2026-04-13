import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ className, variant = 'primary', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amateur-accent',
        variant === 'primary' &&
          'bg-amateur-accent text-white hover:bg-amateur-highlight disabled:opacity-50',
        variant === 'ghost' &&
          'border border-amateur-border bg-amateur-surface text-amateur-ink hover:bg-amateur-canvas',
        className,
      )}
      {...props}
    />
  );
}
