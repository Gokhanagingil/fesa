import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';
import { apiPost } from '../lib/api';
import { useTenant } from '../lib/tenant-hooks';
import type { Guardian } from '../lib/domain-types';

export function GuardianFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenantId) return;
    setSaving(true);
    setError(null);
    try {
      await apiPost<Guardian>('/api/guardians', {
        firstName,
        lastName,
        phone: phone || undefined,
        email: email || undefined,
        notes: notes || undefined,
      });
      navigate('/app/athletes');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title={t('pages.athletes.guardianCreateTitle')} subtitle={t('pages.athletes.guardiansHint')} />
      <div className="mx-auto max-w-xl rounded-2xl border border-amateur-border bg-amateur-surface p-6 shadow-sm">
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
            <Link to="/app/athletes">
              <Button type="button" variant="ghost">
                {t('pages.athletes.cancel')}
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
