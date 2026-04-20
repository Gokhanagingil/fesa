import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import type {
  ClubUpdate,
  ClubUpdateCategory,
  ClubUpdateInput,
  ClubUpdateStatus,
} from '../lib/domain-types';
import { Button } from '../components/ui/Button';
import { InlineAlert } from '../components/ui/InlineAlert';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useTenant } from '../lib/tenant-hooks';

/**
 * Parent Portal v1.1 — staff Club Updates surface.
 *
 * Deliberately small. Each card is title + body + optional safe link +
 * a category and an optional pin/expiry. There is no rich editor, no
 * image pipeline, no comment thread. The intent is "calm note from the
 * club" — anything richer should be deferred to a later wave.
 *
 * The page is mobile-first: the list of cards stacks below the editor on
 * small screens and sits beside it on large screens. We never show more
 * than the cap from the API, so club operators can't accidentally turn
 * the parent portal into a feed.
 */
export function ClubUpdatesPage() {
  const { t, i18n } = useTranslation();
  const { tenantId } = useTenant();
  const [items, setItems] = useState<ClubUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClubUpdate | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await apiGet<ClubUpdate[]>('/api/club-updates');
      setItems(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t, tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = async (input: ClubUpdateInput, target: ClubUpdate | null) => {
    setError(null);
    try {
      if (target) {
        const next = await apiPatch<ClubUpdate>(`/api/club-updates/${target.id}`, input);
        setItems((prev) => prev.map((row) => (row.id === next.id ? next : row)));
      } else {
        const next = await apiPost<ClubUpdate>('/api/club-updates', input);
        setItems((prev) => [next, ...prev]);
      }
      setEditing(null);
      setSavedAt(Date.now());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('app.errors.saveFailed'),
      );
    }
  };

  const action = async (id: string, action: 'publish' | 'archive' | 'remove') => {
    setBusyId(id);
    setError(null);
    try {
      if (action === 'remove') {
        await apiDelete(`/api/club-updates/${id}`);
        setItems((prev) => prev.filter((row) => row.id !== id));
      } else {
        const next = await apiPost<ClubUpdate>(`/api/club-updates/${id}/${action}`, {});
        setItems((prev) => prev.map((row) => (row.id === id ? next : row)));
      }
      setSavedAt(Date.now());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : t('app.errors.saveFailed'),
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={t('pages.clubUpdates.title')}
        subtitle={t('pages.clubUpdates.subtitle')}
        actions={
          editing ? null : (
            <Button onClick={() => setEditing(emptyDraft())}>
              {t('pages.clubUpdates.newCta')}
            </Button>
          )
        }
      />

      {error ? (
        <InlineAlert tone="error" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <div className="space-y-3">
          {loading && items.length === 0 ? (
            <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
          ) : items.length === 0 ? (
            <InlineAlert tone="info">{t('pages.clubUpdates.empty')}</InlineAlert>
          ) : (
            items.map((item) => (
              <UpdateCard
                key={item.id}
                item={item}
                onEdit={() => setEditing(item)}
                onAction={action}
                busyId={busyId}
                language={i18n.language}
              />
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-4">
          {editing ? (
            <UpdateForm
              key={editing.id || 'new'}
              draft={editing}
              onSubmit={(payload) => submit(payload, editing.id ? editing : null)}
              onCancel={() => setEditing(null)}
              savedAt={savedAt}
            />
          ) : (
            <Button className="w-full" onClick={() => setEditing(emptyDraft())}>
              {t('pages.clubUpdates.newCta')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function emptyDraft(): ClubUpdate {
  return {
    id: '',
    tenantId: '',
    category: 'announcement',
    status: 'draft',
    title: '',
    body: '',
    linkUrl: null,
    linkLabel: null,
    publishedAt: null,
    expiresAt: null,
    pinnedUntil: null,
    pinned: false,
    expired: false,
    createdAt: '',
    updatedAt: '',
  };
}

function UpdateCard({
  item,
  onEdit,
  onAction,
  busyId,
  language,
}: {
  item: ClubUpdate;
  onEdit: () => void;
  onAction: (id: string, action: 'publish' | 'archive' | 'remove') => Promise<void>;
  busyId: string | null;
  language: string;
}) {
  const { t } = useTranslation();
  const busy = busyId === item.id;
  return (
    <article className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone(item.status)}>
              {t(`pages.clubUpdates.status.${item.status}`)}
            </StatusBadge>
            <StatusBadge tone="info">
              {t(`pages.clubUpdates.category.${item.category}`)}
            </StatusBadge>
            {item.pinned ? (
              <StatusBadge tone="success">{t('pages.clubUpdates.pinned')}</StatusBadge>
            ) : null}
            {item.expired ? (
              <StatusBadge tone="warning">{t('pages.clubUpdates.expired')}</StatusBadge>
            ) : null}
          </div>
          <h3 className="mt-2 font-display text-base font-semibold text-amateur-ink">{item.title}</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-amateur-muted">{item.body}</p>
          {item.linkUrl ? (
            <p className="mt-2 truncate text-xs text-amateur-muted">
              <span className="font-medium text-amateur-ink">{item.linkLabel ?? item.linkUrl}</span>
              <span className="ml-2 break-all text-amateur-muted/80">{item.linkUrl}</span>
            </p>
          ) : null}
          <p className="mt-3 text-[11px] text-amateur-muted">
            {item.publishedAt
              ? t('pages.clubUpdates.publishedOn', {
                  when: new Date(item.publishedAt).toLocaleString(language),
                })
              : t('pages.clubUpdates.notPublished')}
            {item.expiresAt
              ? ` · ${t('pages.clubUpdates.expiresOn', {
                  when: new Date(item.expiresAt).toLocaleString(language),
                })}`
              : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="ghost" onClick={onEdit} disabled={busy}>
            {t('pages.clubUpdates.actions.edit')}
          </Button>
          {item.status !== 'published' ? (
            <Button onClick={() => void onAction(item.id, 'publish')} disabled={busy}>
              {t('pages.clubUpdates.actions.publish')}
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => void onAction(item.id, 'archive')} disabled={busy}>
              {t('pages.clubUpdates.actions.archive')}
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm(t('pages.clubUpdates.confirmDelete'))) {
                void onAction(item.id, 'remove');
              }
            }}
            disabled={busy}
          >
            {t('pages.clubUpdates.actions.delete')}
          </Button>
        </div>
      </div>
    </article>
  );
}

function statusTone(status: ClubUpdateStatus): 'default' | 'success' | 'info' | 'warning' {
  switch (status) {
    case 'published':
      return 'success';
    case 'archived':
      return 'warning';
    case 'draft':
    default:
      return 'info';
  }
}

function UpdateForm({
  draft,
  onSubmit,
  onCancel,
  savedAt,
}: {
  draft: ClubUpdate;
  onSubmit: (input: ClubUpdateInput) => Promise<void>;
  onCancel: () => void;
  savedAt: number | null;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    category: draft.category,
    status: draft.status,
    title: draft.title,
    body: draft.body,
    linkUrl: draft.linkUrl ?? '',
    linkLabel: draft.linkLabel ?? '',
    expiresAt: toLocalDateTime(draft.expiresAt),
    pinnedUntil: toLocalDateTime(draft.pinnedUntil),
  });
  const [submitting, setSubmitting] = useState(false);
  const isNew = !draft.id;
  const titleCount = form.title.length;
  const bodyCount = form.body.length;

  const titleValid = form.title.trim().length > 0;
  const bodyValid = form.body.trim().length > 0;
  const ready = titleValid && bodyValid;

  return (
    <form
      className="rounded-2xl border border-amateur-border bg-amateur-surface p-4 shadow-sm"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!ready || submitting) return;
        setSubmitting(true);
        try {
          await onSubmit({
            category: form.category,
            status: form.status,
            title: form.title.trim(),
            body: form.body.trim(),
            linkUrl: form.linkUrl.trim() || null,
            linkLabel: form.linkLabel.trim() || null,
            expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
            pinnedUntil: form.pinnedUntil ? new Date(form.pinnedUntil).toISOString() : null,
          });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-amateur-ink">
          {isNew ? t('pages.clubUpdates.formNewTitle') : t('pages.clubUpdates.formEditTitle')}
        </h3>
        {savedAt ? <StatusBadge tone="success">{t('pages.clubUpdates.savedJustNow')}</StatusBadge> : null}
      </div>
      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-amateur-muted">
              {t('pages.clubUpdates.fields.category')}
            </span>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, category: event.target.value as ClubUpdateCategory }))
              }
              className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm"
            >
              <option value="announcement">{t('pages.clubUpdates.category.announcement')}</option>
              <option value="event">{t('pages.clubUpdates.category.event')}</option>
              <option value="reminder">{t('pages.clubUpdates.category.reminder')}</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-amateur-muted">
              {t('pages.clubUpdates.fields.status')}
            </span>
            <select
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value as ClubUpdateStatus }))
              }
              className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm"
            >
              <option value="draft">{t('pages.clubUpdates.status.draft')}</option>
              <option value="published">{t('pages.clubUpdates.status.published')}</option>
              <option value="archived">{t('pages.clubUpdates.status.archived')}</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 flex items-center justify-between text-xs font-medium text-amateur-muted">
            <span>{t('pages.clubUpdates.fields.title')}</span>
            <span className="tabular-nums">{titleCount}/140</span>
          </span>
          <input
            type="text"
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            maxLength={140}
            className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm"
            placeholder={t('pages.clubUpdates.fields.titlePlaceholder')}
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 flex items-center justify-between text-xs font-medium text-amateur-muted">
            <span>{t('pages.clubUpdates.fields.body')}</span>
            <span className="tabular-nums">{bodyCount}/600</span>
          </span>
          <textarea
            value={form.body}
            onChange={(event) => setForm((prev) => ({ ...prev, body: event.target.value }))}
            maxLength={600}
            rows={4}
            className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm"
            placeholder={t('pages.clubUpdates.fields.bodyPlaceholder')}
            required
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-amateur-muted">
              {t('pages.clubUpdates.fields.linkLabel')}
            </span>
            <input
              type="text"
              value={form.linkLabel}
              onChange={(event) => setForm((prev) => ({ ...prev, linkLabel: event.target.value }))}
              maxLength={80}
              className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm"
              placeholder={t('pages.clubUpdates.fields.linkLabelPlaceholder')}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-amateur-muted">
              {t('pages.clubUpdates.fields.linkUrl')}
            </span>
            <input
              type="url"
              value={form.linkUrl}
              onChange={(event) => setForm((prev) => ({ ...prev, linkUrl: event.target.value }))}
              maxLength={512}
              className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm"
              placeholder="https://"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-amateur-muted">
              {t('pages.clubUpdates.fields.pinnedUntil')}
            </span>
            <input
              type="datetime-local"
              value={form.pinnedUntil}
              onChange={(event) => setForm((prev) => ({ ...prev, pinnedUntil: event.target.value }))}
              className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-amateur-muted">
              {t('pages.clubUpdates.fields.expiresAt')}
            </span>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => setForm((prev) => ({ ...prev, expiresAt: event.target.value }))}
              className="w-full rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-ink shadow-sm"
            />
          </label>
        </div>
        <p className="text-xs text-amateur-muted">{t('pages.clubUpdates.formGuardrail')}</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          {t('pages.clubUpdates.actions.cancel')}
        </Button>
        <Button type="submit" disabled={!ready || submitting}>
          {submitting
            ? t('pages.clubUpdates.actions.saving')
            : isNew
              ? t('pages.clubUpdates.actions.create')
              : t('pages.clubUpdates.actions.save')}
        </Button>
      </div>
    </form>
  );
}

function toLocalDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const tzOffset = parsed.getTimezoneOffset() * 60_000;
  return new Date(parsed.getTime() - tzOffset).toISOString().slice(0, 16);
}
