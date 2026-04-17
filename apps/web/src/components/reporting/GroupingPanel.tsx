import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import type {
  ReportAggregateMeasure,
  ReportAggregateOp,
  ReportCatalogEntity,
  ReportFieldDefinition,
  ReportGroupBy,
} from '../../lib/reporting-types';

type Props = {
  entity: ReportCatalogEntity;
  value: ReportGroupBy | null;
  onChange: (next: ReportGroupBy | null) => void;
};

const MAX_MEASURES = 6;

/**
 * Lightweight grouping configuration UI.
 *
 * The product intentionally avoids a pivot-table aesthetic: one dimension,
 * a small list of aggregate measures, an optional sort. Users switch between
 * grouped and row mode at the explorer level.
 */
export function GroupingPanel({ entity, value, onChange }: Props) {
  const { t } = useTranslation();
  const groupableFields = entity.fields.filter((field) => field.groupable);
  const measureFields = entity.fields.filter((field) => (field.aggregations?.length ?? 0) > 0);

  if (groupableFields.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-amateur-border bg-amateur-canvas p-4 text-sm text-amateur-muted">
        {t('pages.reports.aggregate.notSupported')}
      </div>
    );
  }

  const current: ReportGroupBy = value ?? {
    field: groupableFields[0].key,
    measures: [{ op: 'count', alias: 'count' }],
    sort: { alias: 'count', direction: 'desc' },
    limit: 50,
  };

  const updateField = (next: string) => {
    onChange({ ...current, field: next });
  };

  const updateMeasure = (index: number, patch: Partial<ReportAggregateMeasure>) => {
    const measures = current.measures.map((measure, idx) => (idx === index ? { ...measure, ...patch } : measure));
    onChange({ ...current, measures });
  };

  const addMeasure = () => {
    if (current.measures.length >= MAX_MEASURES) return;
    const fallback = measureFields[0];
    const measure: ReportAggregateMeasure = fallback
      ? { op: 'sum', field: fallback.key, alias: `sum_${current.measures.length}` }
      : { op: 'count', alias: `count_${current.measures.length}` };
    onChange({ ...current, measures: [...current.measures, measure] });
  };

  const removeMeasure = (index: number) => {
    const measures = current.measures.filter((_, idx) => idx !== index);
    if (measures.length === 0) {
      measures.push({ op: 'count', alias: 'count' });
    }
    onChange({ ...current, measures });
  };

  return (
    <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amateur-ink">{t('pages.reports.aggregate.title')}</p>
          <p className="mt-1 text-xs text-amateur-muted">{t('pages.reports.aggregate.subtitle')}</p>
        </div>
        <Button type="button" variant="ghost" onClick={() => onChange(null)}>
          {t('pages.reports.aggregate.disable')}
        </Button>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="text-xs uppercase tracking-wide text-amateur-muted">
          <span>{t('pages.reports.aggregate.dimension')}</span>
          <select
            value={current.field}
            onChange={(e) => updateField(e.target.value)}
            className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink"
          >
            {groupableFields.map((field) => (
              <option key={field.key} value={field.key}>
                {t(field.labelKey, field.label ?? field.key)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-amateur-muted">
          <span>{t('pages.reports.aggregate.limit')}</span>
          <input
            type="number"
            min={1}
            max={200}
            value={current.limit ?? 50}
            onChange={(e) => onChange({ ...current, limit: Math.max(1, Number(e.target.value) || 50) })}
            className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-amateur-ink">{t('pages.reports.aggregate.measures')}</p>
          <Button
            type="button"
            variant="ghost"
            onClick={addMeasure}
            disabled={current.measures.length >= MAX_MEASURES}
          >
            {t('pages.reports.aggregate.addMeasure')}
          </Button>
        </div>
        <div className="mt-2 space-y-2">
          {current.measures.map((measure, index) => (
            <MeasureRow
              key={index}
              measure={measure}
              measureFields={measureFields}
              onChange={(patch) => updateMeasure(index, patch)}
              onRemove={() => removeMeasure(index)}
              disableRemove={current.measures.length === 1}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs uppercase tracking-wide text-amateur-muted">
          <span>{t('pages.reports.aggregate.sortBy')}</span>
          <select
            value={current.sort?.alias ?? current.measures[0].alias ?? 'count'}
            onChange={(e) =>
              onChange({
                ...current,
                sort: { alias: e.target.value, direction: current.sort?.direction ?? 'desc' },
              })
            }
            className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink"
          >
            <option value={current.field}>{t('pages.reports.aggregate.sortDimension')}</option>
            {current.measures.map((measure) => (
              <option key={measure.alias} value={measure.alias}>
                {measureLabel(measure, measureFields, t)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-amateur-muted">
          <span>{t('pages.reports.aggregate.direction')}</span>
          <select
            value={current.sort?.direction ?? 'desc'}
            onChange={(e) =>
              onChange({
                ...current,
                sort: {
                  alias: current.sort?.alias ?? current.measures[0].alias ?? 'count',
                  direction: e.target.value === 'asc' ? 'asc' : 'desc',
                },
              })
            }
            className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink"
          >
            <option value="desc">{t('pages.reports.aggregate.directionDesc')}</option>
            <option value="asc">{t('pages.reports.aggregate.directionAsc')}</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function MeasureRow({
  measure,
  measureFields,
  onChange,
  onRemove,
  disableRemove,
}: {
  measure: ReportAggregateMeasure;
  measureFields: ReportFieldDefinition[];
  onChange: (patch: Partial<ReportAggregateMeasure>) => void;
  onRemove: () => void;
  disableRemove: boolean;
}) {
  const { t } = useTranslation();
  const supportedOps: ReportAggregateOp[] = ['count', 'sum', 'avg', 'min', 'max'];

  return (
    <div className="grid gap-2 rounded-xl border border-amateur-border bg-amateur-surface p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto]">
      <label className="text-xs uppercase tracking-wide text-amateur-muted">
        <span>{t('pages.reports.aggregate.measureOp')}</span>
        <select
          value={measure.op}
          onChange={(e) => {
            const nextOp = e.target.value as ReportAggregateOp;
            const patch: Partial<ReportAggregateMeasure> = { op: nextOp };
            if (nextOp === 'count') {
              patch.field = undefined;
            } else if (!measure.field && measureFields[0]) {
              patch.field = measureFields[0].key;
            }
            patch.alias = makeAlias(nextOp, patch.field ?? measure.field, measure.alias);
            onChange(patch);
          }}
          className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
        >
          {supportedOps.map((op) => (
            <option key={op} value={op}>
              {t(`pages.reports.aggregate.measure.${op}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs uppercase tracking-wide text-amateur-muted">
        <span>{t('pages.reports.aggregate.measureField')}</span>
        <select
          value={measure.op === 'count' ? '' : measure.field ?? ''}
          disabled={measure.op === 'count'}
          onChange={(e) =>
            onChange({
              field: e.target.value || undefined,
              alias: makeAlias(measure.op, e.target.value, measure.alias),
            })
          }
          className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink disabled:bg-amateur-canvas/60"
        >
          {measure.op === 'count' ? (
            <option value="">{t('pages.reports.aggregate.measureCountField')}</option>
          ) : null}
          {measureFields
            .filter((field) => measure.op === 'count' || field.aggregations?.includes(measure.op))
            .map((field) => (
              <option key={field.key} value={field.key}>
                {t(field.labelKey, field.label ?? field.key)}
              </option>
            ))}
        </select>
      </label>
      <label className="text-xs uppercase tracking-wide text-amateur-muted">
        <span>{t('pages.reports.aggregate.measureAlias')}</span>
        <input
          type="text"
          value={measure.alias ?? ''}
          onChange={(e) => onChange({ alias: e.target.value })}
          placeholder={makeAlias(measure.op, measure.field, undefined)}
          className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
        />
      </label>
      <div className="flex items-end justify-end">
        <Button type="button" variant="ghost" onClick={onRemove} disabled={disableRemove}>
          {t('pages.reports.aggregate.removeMeasure')}
        </Button>
      </div>
    </div>
  );
}

function makeAlias(
  op: ReportAggregateOp,
  field: string | undefined,
  fallback: string | undefined,
): string {
  if (fallback && fallback.trim()) return fallback;
  if (op === 'count') return 'count';
  if (!field) return op;
  const tail = field.split('.').pop() ?? field;
  return `${op}_${tail}`;
}

function measureLabel(
  measure: ReportAggregateMeasure,
  measureFields: ReportFieldDefinition[],
  t: ReturnType<typeof useTranslation>['t'],
): string {
  const opLabel = t(`pages.reports.aggregate.measure.${measure.op}`);
  if (measure.op === 'count') return opLabel;
  const field = measureFields.find((f) => f.key === measure.field);
  if (!field) return opLabel;
  return `${opLabel} · ${t(field.labelKey, field.label ?? field.key)}`;
}
