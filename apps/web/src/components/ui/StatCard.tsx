type StatCardProps = {
  label: string;
  value: string | number;
  helper?: string;
  tone?: 'default' | 'danger';
  compact?: boolean;
};

export function StatCard({ label, value, helper, tone = 'default', compact = false }: StatCardProps) {
  return (
    <div className={`rounded-2xl border border-amateur-border bg-amateur-surface shadow-sm ${compact ? 'p-4' : 'p-5'}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-amateur-muted">{label}</p>
      <p
        className={`mt-3 font-display font-semibold ${
          compact ? 'text-2xl' : 'text-3xl'
        } ${tone === 'danger' ? 'text-red-700' : 'text-amateur-ink'}`}
      >
        {value}
      </p>
      {helper ? <p className="mt-2 text-sm text-amateur-muted">{helper}</p> : null}
    </div>
  );
}
