import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/Button';
import {
  emptyGroup,
  type ReportCatalogEntity,
  type ReportFieldDefinition,
  type ReportFieldOption,
  type ReportFilterCondition,
  type ReportFilterGroup,
  type ReportFilterNode,
  type ReportFilterOperator,
} from '../../lib/reporting-types';
import { getOperatorLabel, operatorWantsList, operatorWantsRange, operatorWantsValue } from './operatorLabels';

type Props = {
  entity: ReportCatalogEntity;
  value: ReportFilterNode | null;
  onChange: (next: ReportFilterNode | null) => void;
};

function defaultValueFor(field: ReportFieldDefinition, operator: ReportFilterOperator): unknown {
  if (operatorWantsRange(operator)) return ['', ''];
  if (operatorWantsList(operator)) return [];
  if (!operatorWantsValue(operator)) return null;
  if (field.type === 'boolean') return true;
  if (field.type === 'enum') return field.options?.[0]?.value ?? '';
  if (field.type === 'number' || field.type === 'currency') return 0;
  return '';
}

function ensureGroup(node: ReportFilterNode | null): ReportFilterGroup {
  if (node && node.type === 'group') return node;
  if (node && node.type === 'condition') {
    return { type: 'group', combinator: 'and', children: [node] };
  }
  return emptyGroup();
}

export function AdvancedFilterBuilder({ entity, value, onChange }: Props) {
  const { t } = useTranslation();
  const fields = useMemo(
    () => entity.fields.filter((field) => field.operators.length > 0),
    [entity],
  );

  const root = ensureGroup(value);

  const updateChild = (path: number[], updater: (node: ReportFilterNode) => ReportFilterNode | null) => {
    const next = walkAndReplace(root, path, updater);
    if (!next || (next.type === 'group' && next.children.length === 0)) {
      onChange(null);
    } else {
      onChange(next);
    }
  };

  return (
    <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-amateur-ink">{t('pages.reports.builder.title')}</p>
          <p className="mt-1 text-xs text-amateur-muted">{t('pages.reports.builder.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CombinatorToggle
            value={root.combinator}
            onChange={(combinator) => onChange({ ...root, combinator })}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange({ ...root, children: [...root.children, makeCondition(fields)] })}
            disabled={fields.length === 0}
          >
            {t('pages.reports.builder.addCondition')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange({ ...root, children: [...root.children, emptyGroup()] })}
          >
            {t('pages.reports.builder.addGroup')}
          </Button>
          {root.children.length > 0 ? (
            <Button type="button" variant="ghost" onClick={() => onChange(null)}>
              {t('pages.reports.builder.clear')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {root.children.length === 0 ? (
          <p className="rounded-xl border border-dashed border-amateur-border bg-amateur-surface px-4 py-5 text-sm text-amateur-muted">
            {t('pages.reports.builder.empty')}
          </p>
        ) : (
          <ul className="space-y-3">
            {root.children.map((child, index) => (
              <li key={index}>
                <FilterNodeRow
                  node={child}
                  fields={fields}
                  path={[index]}
                  onUpdate={(updater) => updateChild([index], updater)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CombinatorToggle({
  value,
  onChange,
}: {
  value: 'and' | 'or';
  onChange: (next: 'and' | 'or') => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="inline-flex overflow-hidden rounded-xl border border-amateur-border bg-amateur-surface text-xs">
      {(['and', 'or'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`px-3 py-1.5 font-semibold uppercase tracking-wide ${
            value === option ? 'bg-amateur-accent text-white' : 'text-amateur-muted hover:text-amateur-ink'
          }`}
        >
          {t(`pages.reports.builder.combinator.${option}`)}
        </button>
      ))}
    </div>
  );
}

function FilterNodeRow({
  node,
  fields,
  path,
  onUpdate,
}: {
  node: ReportFilterNode;
  fields: ReportFieldDefinition[];
  path: number[];
  onUpdate: (updater: (node: ReportFilterNode) => ReportFilterNode | null) => void;
}) {
  if (node.type === 'group') {
    return <GroupNode node={node} fields={fields} path={path} onUpdate={onUpdate} />;
  }
  return <ConditionNode node={node} fields={fields} onUpdate={onUpdate} />;
}

function GroupNode({
  node,
  fields,
  path,
  onUpdate,
}: {
  node: ReportFilterGroup;
  fields: ReportFieldDefinition[];
  path: number[];
  onUpdate: (updater: (node: ReportFilterNode) => ReportFilterNode | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-amateur-border bg-amateur-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CombinatorToggle
            value={node.combinator}
            onChange={(combinator) => onUpdate(() => ({ ...node, combinator }))}
          />
          <label className="flex items-center gap-2 text-xs text-amateur-muted">
            <input
              type="checkbox"
              checked={Boolean(node.not)}
              onChange={(e) => onUpdate(() => ({ ...node, not: e.target.checked }))}
            />
            {t('pages.reports.builder.notGroup')}
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onUpdate(() => ({
                ...node,
                children: [...node.children, makeCondition(fields)],
              }))
            }
            disabled={fields.length === 0}
          >
            {t('pages.reports.builder.addCondition')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              onUpdate(() => ({
                ...node,
                children: [...node.children, emptyGroup()],
              }))
            }
          >
            {t('pages.reports.builder.addGroup')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onUpdate(() => null)}>
            {t('pages.reports.builder.removeGroup')}
          </Button>
        </div>
      </div>
      <div className="mt-3 space-y-3">
        {node.children.length === 0 ? (
          <p className="rounded-xl border border-dashed border-amateur-border bg-amateur-canvas px-3 py-3 text-xs text-amateur-muted">
            {t('pages.reports.builder.emptyGroup')}
          </p>
        ) : (
          node.children.map((child, index) => (
            <FilterNodeRow
              key={index}
              node={child}
              fields={fields}
              path={[...path, index]}
              onUpdate={(updater) => {
                onUpdate((current) => {
                  if (!current || current.type !== 'group') return current;
                  const nextChild = updater(current.children[index]);
                  const nextChildren = nextChild
                    ? current.children.map((c, i) => (i === index ? nextChild : c))
                    : current.children.filter((_, i) => i !== index);
                  return { ...current, children: nextChildren };
                });
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ConditionNode({
  node,
  fields,
  onUpdate,
}: {
  node: ReportFilterCondition;
  fields: ReportFieldDefinition[];
  onUpdate: (updater: (node: ReportFilterNode) => ReportFilterNode | null) => void;
}) {
  const { t } = useTranslation();
  const field = fields.find((f) => f.key === node.field) ?? fields[0];
  if (!field) return null;

  const supportedOperators = field.operators;
  const operator = supportedOperators.includes(node.operator) ? node.operator : supportedOperators[0];

  return (
    <div className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-3">
      <div className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,2fr)_auto]">
        <label className="text-xs text-amateur-muted">
          <span className="block uppercase tracking-wide">{t('pages.reports.builder.field')}</span>
          <select
            value={field.key}
            onChange={(e) => {
              const nextField = fields.find((f) => f.key === e.target.value)!;
              const nextOp = nextField.operators[0];
              onUpdate(() => ({
                type: 'condition',
                field: nextField.key,
                operator: nextOp,
                value: defaultValueFor(nextField, nextOp),
              }));
            }}
            className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
          >
            {fields.map((f) => (
              <option key={f.key} value={f.key}>
                {t(f.labelKey, f.label ?? f.key)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-amateur-muted">
          <span className="block uppercase tracking-wide">{t('pages.reports.builder.operator')}</span>
          <select
            value={operator}
            onChange={(e) => {
              const nextOp = e.target.value as ReportFilterOperator;
              onUpdate(() => ({
                type: 'condition',
                field: field.key,
                operator: nextOp,
                value: defaultValueFor(field, nextOp),
              }));
            }}
            className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
          >
            {supportedOperators.map((op) => (
              <option key={op} value={op}>
                {getOperatorLabel(t, op)}
              </option>
            ))}
          </select>
        </label>
        <div className="text-xs text-amateur-muted">
          <span className="block uppercase tracking-wide">{t('pages.reports.builder.value')}</span>
          <ValueEditor
            field={field}
            operator={operator}
            value={node.value}
            onChange={(nextValue) =>
              onUpdate(() => ({
                type: 'condition',
                field: field.key,
                operator,
                value: nextValue,
              }))
            }
          />
        </div>
        <div className="flex items-end justify-end">
          <Button type="button" variant="ghost" onClick={() => onUpdate(() => null)}>
            {t('pages.reports.builder.removeCondition')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ValueEditor({
  field,
  operator,
  value,
  onChange,
}: {
  field: ReportFieldDefinition;
  operator: ReportFilterOperator;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const { t } = useTranslation();
  if (!operatorWantsValue(operator)) {
    return <p className="mt-1 text-xs italic text-amateur-muted">{t('pages.reports.builder.noValue')}</p>;
  }
  if (operatorWantsRange(operator)) {
    const tuple = Array.isArray(value) ? (value as [unknown, unknown]) : ['', ''];
    return (
      <div className="mt-1 grid grid-cols-2 gap-2">
        <SimpleInput field={field} value={tuple[0]} onChange={(v) => onChange([v, tuple[1]])} />
        <SimpleInput field={field} value={tuple[1]} onChange={(v) => onChange([tuple[0], v])} />
      </div>
    );
  }
  if (operatorWantsList(operator)) {
    const list = Array.isArray(value) ? (value as unknown[]) : [];
    return (
      <ListValueEditor
        field={field}
        list={list.map((item) => (item === null || item === undefined ? '' : String(item)))}
        onChange={onChange}
      />
    );
  }
  return <SimpleInput field={field} value={value} onChange={onChange} />;
}

function SimpleInput({
  field,
  value,
  onChange,
}: {
  field: ReportFieldDefinition;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const { t } = useTranslation();
  if (field.type === 'boolean') {
    return (
      <select
        value={String(value ?? 'true')}
        onChange={(e) => onChange(e.target.value === 'true')}
        className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
      >
        <option value="true">{t('pages.reports.builder.boolTrue')}</option>
        <option value="false">{t('pages.reports.builder.boolFalse')}</option>
      </select>
    );
  }
  if (field.type === 'enum') {
    return (
      <select
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
      >
        <option value="">{t('pages.reports.builder.selectValue')}</option>
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {renderOption(t, option)}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === 'number' || field.type === 'currency') {
    return (
      <input
        type="number"
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => {
          const numeric = e.target.value === '' ? null : Number(e.target.value);
          onChange(numeric);
        }}
        className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
      />
    );
  }
  if (field.type === 'date') {
    return (
      <input
        type="date"
        value={value ? String(value).slice(0, 10) : ''}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
      />
    );
  }
  if (field.type === 'datetime') {
    return (
      <input
        type="datetime-local"
        value={value ? String(value).slice(0, 16) : ''}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
        className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
      />
    );
  }
  return (
    <input
      type="text"
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t('pages.reports.builder.placeholder')}
      className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
    />
  );
}

function renderOption(t: ReturnType<typeof useTranslation>['t'], option: ReportFieldOption): string {
  if (option.labelKey) {
    return t(option.labelKey, option.label ?? option.value);
  }
  return option.label ?? option.value;
}

function ListValueEditor({
  field,
  list,
  onChange,
}: {
  field: ReportFieldDefinition;
  list: string[];
  onChange: (next: unknown[]) => void;
}) {
  const { t } = useTranslation();
  if (field.type === 'enum' && field.options?.length) {
    const set = new Set(list);
    return (
      <div className="mt-1 grid gap-1 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-xs text-amateur-ink">
        {field.options.map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={set.has(option.value)}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange([...list, option.value]);
                } else {
                  onChange(list.filter((v) => v !== option.value));
                }
              }}
            />
            {renderOption(t, option)}
          </label>
        ))}
      </div>
    );
  }
  return (
    <input
      type="text"
      value={list.join(', ')}
      onChange={(e) =>
        onChange(
          e.target.value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        )
      }
      placeholder={t('pages.reports.builder.listPlaceholder')}
      className="mt-1 w-full rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-ink"
    />
  );
}

function makeCondition(fields: ReportFieldDefinition[]): ReportFilterCondition {
  const field = fields[0];
  const operator = field.operators[0];
  return {
    type: 'condition',
    field: field.key,
    operator,
    value: defaultValueFor(field, operator),
  };
}

function walkAndReplace(
  root: ReportFilterGroup,
  path: number[],
  updater: (node: ReportFilterNode) => ReportFilterNode | null,
): ReportFilterGroup | null {
  if (path.length === 0) {
    const next = updater(root);
    if (!next) return null;
    if (next.type !== 'group') {
      return { type: 'group', combinator: 'and', children: [next] };
    }
    return next;
  }
  const [head, ...rest] = path;
  const child = root.children[head];
  if (!child) return root;
  const nextChild = rest.length === 0 ? updater(child) : walkAndReplace(child as ReportFilterGroup, rest, updater);
  const nextChildren = nextChild
    ? root.children.map((c, i) => (i === head ? nextChild : c))
    : root.children.filter((_, i) => i !== head);
  return { ...root, children: nextChildren };
}
