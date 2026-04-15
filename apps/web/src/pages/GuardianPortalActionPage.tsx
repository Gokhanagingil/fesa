import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { InlineAlert } from '../components/ui/InlineAlert';
import { StatusBadge } from '../components/ui/StatusBadge';
import { apiGet, apiPost } from '../lib/api';
import {
  formatDate,
  getFamilyActionActorLabel,
  getFamilyActionStatusLabel,
  getFamilyActionTypeLabel,
} from '../lib/display';
import type { FamilyActionRequest, GuardianPortalActionSubmissionInput } from '../lib/domain-types';

export function GuardianPortalActionPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [action, setAction] = useState<FamilyActionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!id) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiGet<FamilyActionRequest>(`/api/guardian-portal/actions/${id}`);
        setAction(result);
        const submission =
          result.payload?.portalSubmission && typeof result.payload.portalSubmission === 'object'
            ? (result.payload.portalSubmission as {
                suggestedUpdates?: { phone?: string; email?: string; notes?: string };
                responseText?: string | null;
              })
            : null;
        setResponseText(submission?.responseText ?? result.latestResponseText ?? '');
        setPhone(submission?.suggestedUpdates?.phone ?? '');
        setEmail(submission?.suggestedUpdates?.email ?? '');
        setNotes(submission?.suggestedUpdates?.notes ?? '');
      } catch (nextError) {
        setError(nextError instanceof Error ? nextError.message : t('app.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, t]);

  async function submit() {
    if (!id) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload: GuardianPortalActionSubmissionInput = {
        responseText: responseText.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
      };
      await apiPost(`/api/guardian-portal/actions/${id}/submit`, payload);
      setMessage(t('pages.guardianPortal.action.submitSuccess'));
      setTimeout(() => navigate('/portal'), 700);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>;
  }

  if (!action) {
    return (
      <div className="space-y-4">
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
        <Link to="/portal" className="text-sm font-medium text-amateur-accent hover:underline">
          {t('pages.guardianPortal.backHome')}
        </Link>
      </div>
    );
  }

  const canSubmit = ['open', 'pending_family_action', 'rejected'].includes(action.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/portal" className="text-sm font-medium text-amateur-accent hover:underline">
            {t('pages.guardianPortal.backHome')}
          </Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-amateur-ink">{action.title}</h1>
          <p className="mt-1 text-sm text-amateur-muted">
            {[
              action.athleteName,
              getFamilyActionTypeLabel(t, action.type),
              action.dueDate ? formatDate(action.dueDate, i18n.language) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <StatusBadge tone={canSubmit ? 'warning' : action.status === 'completed' ? 'success' : 'info'}>
          {getFamilyActionStatusLabel(t, action.status)}
        </StatusBadge>
      </div>

      {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}
      {message ? <InlineAlert tone="success">{message}</InlineAlert> : null}

      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-amateur-ink">
          {t('pages.guardianPortal.action.requestTitle')}
        </h2>
        {action.description ? <p className="mt-3 text-sm text-amateur-muted">{action.description}</p> : null}
        {action.decisionNote ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-medium">{t('pages.guardianPortal.action.staffNote')}</p>
            <p className="mt-1 whitespace-pre-wrap">{action.decisionNote}</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-amateur-ink">
          {t('pages.guardianPortal.action.responseTitle')}
        </h2>
        <p className="mt-1 text-sm text-amateur-muted">{t('pages.guardianPortal.action.responseHint')}</p>
        <div className="mt-4 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('pages.guardianPortal.action.responseLabel')}</span>
            <textarea
              value={responseText}
              onChange={(event) => setResponseText(event.target.value)}
              rows={5}
              disabled={!canSubmit || saving}
              className="resize-y rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30 disabled:opacity-60"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.guardianPortal.action.phone')}</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={!canSubmit || saving}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30 disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('pages.guardianPortal.action.email')}</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!canSubmit || saving}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30 disabled:opacity-60"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span>{t('pages.guardianPortal.action.notes')}</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              disabled={!canSubmit || saving}
              className="resize-y rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30 disabled:opacity-60"
            />
          </label>
          {canSubmit ? (
            <Button type="button" onClick={() => void submit()} disabled={saving}>
              {t('pages.guardianPortal.action.submit')}
            </Button>
          ) : (
            <InlineAlert tone="info">{t('pages.guardianPortal.action.readOnlyHint')}</InlineAlert>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-amateur-border bg-amateur-surface p-5 shadow-sm">
        <h2 className="font-display text-lg font-semibold text-amateur-ink">
          {t('pages.guardianPortal.action.historyTitle')}
        </h2>
        <div className="mt-4 space-y-3">
          {action.events.map((event) => (
            <div key={event.id} className="rounded-xl border border-amateur-border bg-amateur-canvas px-4 py-3">
              <p className="text-sm font-medium text-amateur-ink">
                {getFamilyActionActorLabel(t, event.actor)} ·{' '}
                {event.toStatus ? getFamilyActionStatusLabel(t, event.toStatus) : event.eventType}
              </p>
              <p className="mt-1 text-xs text-amateur-muted">{formatDate(event.createdAt, i18n.language)}</p>
              {event.note ? <p className="mt-2 text-sm text-amateur-muted">{event.note}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
