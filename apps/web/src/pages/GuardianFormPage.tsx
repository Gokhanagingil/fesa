import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { getGuardianRelationshipLabel } from '../lib/display';
import { useTenant } from '../lib/tenant-hooks';
import type { Guardian } from '../lib/domain-types';

const relationshipOptions = ['mother', 'father', 'guardian', 'other'] as const;

export function GuardianFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const athleteId = searchParams.get('athleteId');
  const returnTo = searchParams.get('returnTo');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [relationshipType, setRelationshipType] = useState<(typeof relationshipOptions)[number]>('mother');
  const [isPrimaryContact, setIsPrimaryContact] = useState(false);

  const cancelTarget = useMemo(() => {
    if (returnTo) return returnTo;
    if (!isNew && id) return `/app/guardians/${id}`;
    if (athleteId) return `/app/athletes/${athleteId}`;
    return '/app/guardians';
  }, [athleteId, id, isNew, returnTo]);

  useEffect(() => {
    if (!tenantId || isNew || !id) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const guardian = await apiGet<Guardian>(`/api/guardians/${id}`);
        setFirstName(guardian.firstName);
        setLastName(guardian.lastName);
        setPhone(guardian.phone ?? '');
        setEmail(guardian.email ?? '');
        setNotes(guardian.notes ?? '');
      } catch (e) {
        setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isNew, t, tenantId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        firstName,
        lastName,
        phone: phone || undefined,
        email: email || undefined,
        notes: notes || undefined,
      };

      if (isNew) {
        const created = await apiPost<Guardian>('/api/guardians', payload);
        if (athleteId) {
          await apiPost(`/api/athletes/${athleteId}/guardians`, {
            guardianId: created.id,
            relationshipType,
            isPrimaryContact,
          });
        }
        navigate(returnTo || (athleteId ? `/app/athletes/${athleteId}` : `/app/guardians/${created.id}`));
      } else {
        await apiPatch<Guardian>(`/api/guardians/${id}`, payload);
        navigate(returnTo || `/app/guardians/${id}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? t('pages.guardians.new') : t('pages.guardians.edit')}
        subtitle={athleteId ? t('pages.guardians.linkedCreateHint') : t('pages.guardians.subtitle')}
      />
      <div className="mx-auto max-w-xl rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
        {loading ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('pages.athletes.firstName')}</span>
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('pages.athletes.lastName')}</span>
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pages.athletes.phone')}</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pages.athletes.email')}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30"
              />
            </label>
            {athleteId && isNew ? (
              <div className="rounded-xl border border-amateur-border bg-amateur-canvas p-4">
                <p className="text-sm font-medium text-amateur-ink">{t('pages.guardians.linkToAthlete')}</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>{t('pages.athletes.relationship')}</span>
                    <select
                      value={relationshipType}
                      onChange={(e) => setRelationshipType(e.target.value as (typeof relationshipOptions)[number])}
                      className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                    >
                      {relationshipOptions.map((option) => (
                        <option key={option} value={option}>
                          {getGuardianRelationshipLabel(t, option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isPrimaryContact}
                      onChange={(e) => setIsPrimaryContact(e.target.checked)}
                    />
                    {t('pages.athletes.primaryContact')}
                  </label>
                </div>
              </div>
            ) : null}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('pages.athletes.notes')}</span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="resize-y rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 outline-none focus:ring-2 focus:ring-amateur-accent/30"
              />
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {t('pages.athletes.save')}
              </Button>
              <Link to={cancelTarget}>
                <Button type="button" variant="ghost">
                  {t('pages.athletes.cancel')}
                </Button>
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
