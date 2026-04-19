import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { useTenant } from '../lib/tenant-hooks';
import { apiGet } from '../lib/api';
import {
  ImportEntityDefinition,
  ImportEntityKey,
  ImportFieldDefinition,
  ImportPreviewReport,
  ImportRowOutcome,
  ImportRowReport,
  autoMapColumns,
  buildTemplateUrl,
  commitImport,
  fetchImportDefinitions,
  parseCsv,
  previewImport,
} from '../lib/imports';
import type { SportBranch } from '../lib/domain-types';

const OUTCOME_TONES: Record<ImportRowOutcome, string> = {
  create: 'bg-emerald-100 text-emerald-800',
  update: 'bg-sky-100 text-sky-800',
  skip: 'bg-slate-100 text-slate-700',
  reject: 'bg-rose-100 text-rose-700',
};

const ISSUE_TONES = {
  error: 'text-rose-700',
  warning: 'text-amber-700',
  info: 'text-amateur-muted',
} as const;

type ParsedRow = { rowNumber: number; cells: Record<string, string> };

export function ImportsPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [definitions, setDefinitions] = useState<ImportEntityDefinition[]>([]);
  const [definitionsError, setDefinitionsError] = useState<string | null>(null);
  const [activeEntity, setActiveEntity] = useState<ImportEntityKey>('athletes');
  const [branches, setBranches] = useState<SportBranch[]>([]);
  const [defaultBranchId, setDefaultBranchId] = useState('');
  const [rawCsv, setRawCsv] = useState('');
  const [pickedFileName, setPickedFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [autoMapped, setAutoMapped] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<ImportPreviewReport | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const definition = useMemo(
    () => definitions.find((entry) => entry.entity === activeEntity),
    [definitions, activeEntity],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const items = await fetchImportDefinitions();
        if (!cancelled) setDefinitions(items);
      } catch (e) {
        if (!cancelled)
          setDefinitionsError(e instanceof Error ? e.message : t('pages.imports.loadFailed'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
        const list = await apiGet<SportBranch[]>('/api/sport-branches');
        setBranches(list);
      } catch {
        setBranches([]);
      }
    })();
  }, [tenantId]);

  const resetParseState = useCallback(() => {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setAutoMapped(new Set());
    setPreview(null);
    setMessage(null);
    setError(null);
  }, []);

  const handleEntityChange = (entity: ImportEntityKey) => {
    setActiveEntity(entity);
    resetParseState();
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setRawCsv(text);
      setPickedFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    if (!definition) return;
    const result = parseCsv(rawCsv);
    if (result.headers.length === 0) {
      setError(t('pages.imports.previewEmpty'));
      return;
    }
    const auto = autoMapColumns(result.headers, definition.fields);
    setHeaders(result.headers);
    setRows(result.rows);
    setMapping(auto.mapping);
    setAutoMapped(auto.auto);
    setPreview(null);
    setMessage(null);
    setError(null);
  };

  const handleMappingChange = (header: string, target: string) => {
    setMapping((current) => {
      const next: Record<string, string> = { ...current };
      Object.entries(next).forEach(([key, value]) => {
        if (value === target && key !== header) delete next[key];
      });
      if (target) next[header] = target;
      else delete next[header];
      return next;
    });
    setAutoMapped((current) => {
      const next = new Set(current);
      next.delete(header);
      return next;
    });
  };

  const requiredMissing = useMemo(() => {
    if (!definition) return [];
    const mapped = new Set(Object.values(mapping));
    return definition.fields.filter((field) => field.required && !mapped.has(field.key));
  }, [definition, mapping]);

  const canPreview = rows.length > 0 && requiredMissing.length === 0 && !!definition;

  async function handlePreview() {
    if (!definition || rows.length === 0) return;
    setPreviewing(true);
    setError(null);
    setMessage(null);
    try {
      const result = await previewImport({
        entity: definition.entity,
        columnMapping: mapping,
        rows,
        defaultSportBranchId: defaultBranchId || undefined,
      });
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCommit() {
    if (!definition || !preview?.canCommit) return;
    setCommitting(true);
    setError(null);
    try {
      const result = await commitImport({
        entity: definition.entity,
        columnMapping: mapping,
        rows,
        defaultSportBranchId: defaultBranchId || undefined,
      });
      setMessage(
        t('pages.imports.commitSuccess', {
          created: result.counts.created,
          updated: result.counts.updated,
          skipped: result.counts.skipped,
        }),
      );
      setPreview({ ...preview, rows: result.rows });
      setRawCsv('');
      setRows([]);
      setHeaders([]);
      setMapping({});
      setAutoMapped(new Set());
      if (fileInputRef.current) fileInputRef.current.value = '';
      setPickedFileName(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setCommitting(false);
    }
  }

  if (!tenantId && !tenantLoading) {
    return (
      <div>
        <PageHeader title={t('pages.imports.title')} subtitle={t('pages.imports.subtitle')} />
        <ListPageFrame>
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        </ListPageFrame>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('pages.imports.title')} subtitle={t('pages.imports.subtitle')} />

      <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <p className="font-display text-base font-semibold text-amateur-ink">
          {t('pages.imports.introTitle')}
        </p>
        <p className="mt-1 text-sm text-amateur-muted">{t('pages.imports.intro')}</p>
        {definitionsError ? (
          <InlineAlert tone="error" className="mt-3">
            {definitionsError}
          </InlineAlert>
        ) : null}
      </section>

      <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <p className="mb-3 font-display text-sm font-semibold text-amateur-ink">
          {t('pages.imports.pickEntity')}
        </p>
        <div className="flex flex-wrap gap-2">
          {definitions.map((entry) => (
            <button
              key={entry.entity}
              type="button"
              onClick={() => handleEntityChange(entry.entity)}
              className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                activeEntity === entry.entity
                  ? 'border-amateur-accent bg-amateur-accent text-white shadow-sm'
                  : 'border-amateur-border bg-amateur-canvas text-amateur-ink hover:border-amateur-accent'
              }`}
            >
              <p className="font-semibold">{t(entry.labelKey)}</p>
              <p
                className={`mt-1 text-xs ${
                  activeEntity === entry.entity ? 'text-white/80' : 'text-amateur-muted'
                }`}
              >
                {t(entry.descriptionKey)}
              </p>
            </button>
          ))}
        </div>
        {definition ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={buildTemplateUrl(definition.entity)}
              className="inline-flex items-center justify-center rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm font-semibold text-amateur-ink hover:bg-amateur-surface"
              download
            >
              {t('pages.imports.templateButton')}
            </a>
            <p className="text-xs text-amateur-muted">{t('pages.imports.templateHint')}</p>
          </div>
        ) : null}
        {definition?.entity === 'athletes' ? (
          <div className="mt-4 grid gap-3 sm:max-w-md">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-amateur-ink">
                {t('pages.imports.defaultBranchLabel')}
              </span>
              <select
                value={defaultBranchId}
                onChange={(event) => setDefaultBranchId(event.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2"
              >
                <option value="">{t('pages.imports.anyBranch')}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-amateur-muted">{t('pages.imports.defaultBranchHint')}</span>
            </label>
          </div>
        ) : null}
      </section>

      <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <p className="font-display text-sm font-semibold text-amateur-ink">
          {t('pages.imports.uploadTitle')}
        </p>
        <p className="mt-1 text-sm text-amateur-muted">{t('pages.imports.uploadHint')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm font-semibold text-amateur-ink hover:bg-amateur-surface">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFile}
            />
            {t('pages.imports.fileButton')}
          </label>
          {pickedFileName ? (
            <p className="text-xs text-amateur-muted">
              {t('pages.imports.filePicked', { name: pickedFileName, count: rows.length })}
            </p>
          ) : null}
        </div>
        <label className="mt-4 flex flex-col gap-1 text-sm">
          <span className="font-medium text-amateur-ink">{t('pages.imports.rawLabel')}</span>
          <textarea
            value={rawCsv}
            onChange={(event) => setRawCsv(event.target.value)}
            rows={6}
            spellCheck={false}
            className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 font-mono text-xs"
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={handleParse} disabled={!rawCsv.trim()}>
            {headers.length > 0 ? t('pages.imports.parseAgain') : t('pages.imports.parseButton')}
          </Button>
          {headers.length > 0 ? (
            <p className="text-xs text-amateur-muted">
              {t('pages.imports.parsedHint', { count: rows.length })}
            </p>
          ) : null}
        </div>
      </section>

      {definition && headers.length > 0 ? (
        <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
          <p className="font-display text-sm font-semibold text-amateur-ink">
            {t('pages.imports.mappingTitle')}
          </p>
          <p className="mt-1 text-sm text-amateur-muted">{t('pages.imports.mappingHint')}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-amateur-border text-amateur-muted">
                  <th className="pb-2 pr-4 font-medium">{t('pages.imports.mappingSource')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('pages.imports.mappingTarget')}</th>
                </tr>
              </thead>
              <tbody>
                {headers.map((header) => (
                  <MappingRow
                    key={header}
                    header={header}
                    fields={definition.fields}
                    selected={mapping[header] ?? ''}
                    auto={autoMapped.has(header)}
                    onChange={handleMappingChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {requiredMissing.length > 0 ? (
            <InlineAlert tone="warning" className="mt-3">
              {t('pages.imports.mappingRequiredMissing')}
            </InlineAlert>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="button" onClick={() => void handlePreview()} disabled={!canPreview || previewing}>
              {previewing ? t('pages.imports.previewLoading') : t('pages.imports.previewButton')}
            </Button>
            <p className="text-xs text-amateur-muted">{t('pages.imports.previewHint')}</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <InlineAlert tone="error" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}
      {message ? (
        <InlineAlert tone="success" className="mb-4">
          {message}
        </InlineAlert>
      ) : null}

      {preview ? (
        <PreviewPanel
          preview={preview}
          definition={definition}
          committing={committing}
          onCommit={handleCommit}
        />
      ) : (
        <ListPageFrame>
          <EmptyState
            title={t('pages.imports.previewTitle')}
            hint={t('pages.imports.previewEmpty')}
          />
        </ListPageFrame>
      )}
    </div>
  );
}

interface MappingRowProps {
  header: string;
  fields: ImportFieldDefinition[];
  selected: string;
  auto: boolean;
  onChange: (header: string, target: string) => void;
}

function MappingRow({ header, fields, selected, auto, onChange }: MappingRowProps) {
  const { t } = useTranslation();
  return (
    <tr className="border-b border-amateur-border/70 last:border-0">
      <td className="py-2 pr-4">
        <span className="font-medium text-amateur-ink">{header}</span>
        {auto ? (
          <span className="ml-2 inline-flex rounded-full bg-amateur-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amateur-accent">
            {t('pages.imports.mappingAuto')}
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-4">
        <select
          value={selected}
          onChange={(event) => onChange(header, event.target.value)}
          className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm"
        >
          <option value="">{t('pages.imports.mappingIgnore')}</option>
          {fields.map((field) => (
            <option key={field.key} value={field.key}>
              {t(field.labelKey)}
              {field.required ? ' *' : ''}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

interface PreviewPanelProps {
  preview: ImportPreviewReport;
  definition?: ImportEntityDefinition;
  committing: boolean;
  onCommit: () => void;
}

function PreviewPanel({ preview, definition, committing, onCommit }: PreviewPanelProps) {
  const { t } = useTranslation();
  const fieldLabel = (key: string) => {
    const field = definition?.fields.find((entry) => entry.key === key);
    return field ? t(field.labelKey) : key;
  };

  return (
    <section className="mb-6 rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-base font-semibold text-amateur-ink">
            {t('pages.imports.previewTitle')}
          </p>
          <p className="mt-1 text-sm text-amateur-muted">{t('pages.imports.previewHint')}</p>
        </div>
        <Button
          type="button"
          onClick={onCommit}
          disabled={!preview.canCommit || committing || preview.counts.total === 0}
        >
          {committing ? t('pages.imports.committing') : t('pages.imports.commitButton')}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t('pages.imports.summaryCreate', { count: preview.counts.createReady })}
          value={preview.counts.createReady}
        />
        <StatCard
          label={t('pages.imports.summaryUpdate', { count: preview.counts.updateReady })}
          value={preview.counts.updateReady}
        />
        <StatCard
          label={t('pages.imports.summarySkip', { count: preview.counts.skipReady })}
          value={preview.counts.skipReady}
        />
        <StatCard
          label={t('pages.imports.summaryReject', { count: preview.counts.rejected })}
          value={preview.counts.rejected}
          tone={preview.counts.rejected > 0 ? 'danger' : 'default'}
        />
      </div>

      {preview.counts.warnings > 0 ? (
        <InlineAlert tone="warning" className="mt-3">
          {t('pages.imports.summaryWarnings', { count: preview.counts.warnings })}
        </InlineAlert>
      ) : null}

      {preview.missingRequired.length > 0 ? (
        <InlineAlert tone="error" className="mt-3">
          <ul className="list-disc pl-4">
            {preview.missingRequired.map((entry) => (
              <li key={entry.field}>
                {t('pages.imports.missingRequired', {
                  count: entry.rowCount,
                  field: fieldLabel(entry.field),
                })}
              </li>
            ))}
          </ul>
        </InlineAlert>
      ) : null}

      {!preview.canCommit ? (
        <InlineAlert tone="warning" className="mt-3">
          {t('pages.imports.commitBlocked')}
        </InlineAlert>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-amateur-border text-amateur-muted">
              <th className="pb-2 pr-4 font-medium">{t('pages.imports.rowNumber')}</th>
              <th className="pb-2 pr-4 font-medium">{t('pages.imports.rowDisplay')}</th>
              <th className="pb-2 pr-4 font-medium">{t('pages.imports.rowReady')}</th>
              <th className="pb-2 font-medium">{t('pages.imports.rowIssues')}</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <PreviewRow key={`${row.rowNumber}-${row.displayLabel}`} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PreviewRow({ row }: { row: ImportRowReport }) {
  const { t } = useTranslation();
  return (
    <tr className="border-b border-amateur-border/70 align-top last:border-0">
      <td className="py-2 pr-4 text-amateur-muted">#{row.rowNumber}</td>
      <td className="py-2 pr-4 font-medium text-amateur-ink">{row.displayLabel || '—'}</td>
      <td className="py-2 pr-4">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_TONES[row.outcome]}`}
        >
          {t(`pages.imports.rowOutcome.${row.outcome}`)}
        </span>
      </td>
      <td className="py-2 text-amateur-muted">
        {row.issues.length === 0 ? (
          <span className="text-xs text-amateur-muted">{t('pages.imports.noIssues')}</span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {row.issues.map((issue, idx) => (
              <li key={idx} className={ISSUE_TONES[issue.severity]}>
                {issue.field ? `${issue.field}: ${issue.message}` : issue.message}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
}
