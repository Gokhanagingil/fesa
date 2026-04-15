import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { apiGet } from '../lib/api';
import { getPersonName } from '../lib/display';
import { useTenant } from '../lib/tenant-hooks';
import type {
  ClubGroup,
  CommunicationAudienceResponse,
  Coach,
  Team,
  TrainingSession,
} from '../lib/domain-types';

export function CommunicationsPage() {
  const { t } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [query, setQuery] = useState('');
  const [groupId, setGroupId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [financialState, setFinancialState] = useState('');
  const [privateLessonStatus, setPrivateLessonStatus] = useState('');
  const [trainingSessionId, setTrainingSessionId] = useState('');
  const [primaryContactsOnly, setPrimaryContactsOnly] = useState(false);
  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [audience, setAudience] = useState<CommunicationAudienceResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
        const [groupRes, teamRes, coachRes, sessionRes] = await Promise.all([
          apiGet<{ items: ClubGroup[] }>('/api/groups?limit=200'),
          apiGet<{ items: Team[] }>('/api/teams?limit=200'),
          apiGet<{ items: Coach[] }>('/api/coaches?limit=200'),
          apiGet<{ items: TrainingSession[] }>('/api/training-sessions?limit=100'),
        ]);
        setGroups(groupRes.items);
        setTeams(teamRes.items);
        setCoaches(coachRes.items);
        setSessions(sessionRes.items);
      } catch {
        setGroups([]);
        setTeams([]);
        setCoaches([]);
        setSessions([]);
      }
    })();
  }, [tenantId]);

  const loadAudience = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (groupId) params.set('groupId', groupId);
      if (teamId) params.set('teamId', teamId);
      if (coachId) params.set('coachId', coachId);
      if (financialState) params.set('financialState', financialState);
      if (privateLessonStatus) params.set('privateLessonStatus', privateLessonStatus);
      if (trainingSessionId) params.set('trainingSessionId', trainingSessionId);
      if (primaryContactsOnly) params.set('primaryContactsOnly', 'true');

      const res = await apiGet<CommunicationAudienceResponse>(`/api/communications/audiences?${params.toString()}`);
      setAudience(res);
      if (!draftTitle) {
        setDraftTitle(t('pages.communications.defaultDraftTitle'));
      }
      if (!draftBody) {
        setDraftBody(t('pages.communications.defaultDraftBody'));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [coachId, draftBody, draftTitle, financialState, groupId, primaryContactsOnly, privateLessonStatus, query, t, teamId, tenantId, trainingSessionId]);

  useEffect(() => {
    const id = setTimeout(() => void loadAudience(), 250);
    return () => clearTimeout(id);
  }, [loadAudience]);

  const visibleTeams = useMemo(
    () => (groupId ? teams.filter((team) => team.groupId === groupId) : teams),
    [groupId, teams],
  );

  const contactLines = useMemo(() => {
    if (!audience) return [];
    return audience.items.flatMap((item) =>
      item.guardians.map((guardian) => `${item.athleteName} · ${guardian.name} · ${guardian.phone || guardian.email || '—'}`),
    );
  }, [audience]);

  return (
    <div>
      <PageHeader
        title={t('pages.communications.title')}
        subtitle={t('pages.communications.subtitle')}
        actions={
          <Button type="button" variant="ghost" onClick={() => void loadAudience()}>
            {t('app.actions.refresh')}
          </Button>
        }
      />

      {error ? (
        <InlineAlert tone="error" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}

      <ListPageFrame
        search={{
          value: query,
          onChange: setQuery,
          disabled: !tenantId || tenantLoading,
          placeholder: t('pages.communications.searchPlaceholder'),
        }}
        toolbar={
          <>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.athletes.primaryGroup')}</span>
              <select
                value={groupId}
                onChange={(e) => {
                  setGroupId(e.target.value);
                  setTeamId('');
                }}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.communications.allGroups')}</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.teams.title')}</span>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="bg-transparent text-amateur-ink outline-none">
                <option value="">{t('pages.communications.allTeams')}</option>
                {visibleTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.coaches.title')}</span>
              <select value={coachId} onChange={(e) => setCoachId(e.target.value)} className="bg-transparent text-amateur-ink outline-none">
                <option value="">{t('pages.communications.allCoaches')}</option>
                {coaches.map((coach) => (
                  <option key={coach.id} value={coach.id}>
                    {getPersonName(coach)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.communications.financialState')}</span>
              <select
                value={financialState}
                onChange={(e) => setFinancialState(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.communications.anyFinancialState')}</option>
                <option value="outstanding">{t('pages.communications.financialOutstanding')}</option>
                <option value="overdue">{t('pages.communications.financialOverdue')}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.communications.privateLessonStatus')}</span>
              <select
                value={privateLessonStatus}
                onChange={(e) => setPrivateLessonStatus(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.communications.anyLessonStatus')}</option>
                <option value="planned">{t('app.enums.trainingStatus.planned')}</option>
                <option value="completed">{t('app.enums.trainingStatus.completed')}</option>
                <option value="cancelled">{t('app.enums.trainingStatus.cancelled')}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <span>{t('pages.training.detailTitle')}</span>
              <select
                value={trainingSessionId}
                onChange={(e) => setTrainingSessionId(e.target.value)}
                className="bg-transparent text-amateur-ink outline-none"
              >
                <option value="">{t('pages.communications.anySession')}</option>
                {sessions.slice(0, 50).map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-canvas px-3 py-2 text-sm text-amateur-muted">
              <input
                type="checkbox"
                checked={primaryContactsOnly}
                onChange={(e) => setPrimaryContactsOnly(e.target.checked)}
              />
              <span>{t('pages.communications.primaryContactsOnly')}</span>
            </label>
          </>
        }
      >
        {!tenantId && !tenantLoading ? (
          <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
        ) : loading && !audience ? (
          <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
        ) : !audience ? (
          <EmptyState title={t('pages.communications.empty')} hint={t('pages.communications.emptyHint')} />
        ) : (
          <div className="space-y-6">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label={t('pages.communications.summaryAthletes')} value={audience.counts.athletes} compact />
              <StatCard label={t('pages.communications.summaryGuardians')} value={audience.counts.guardians} compact />
              <StatCard label={t('pages.communications.summaryPrimaryContacts')} value={audience.counts.primaryContacts} compact />
              <StatCard
                label={t('pages.communications.summaryOverdue')}
                value={audience.counts.withOverdueBalance}
                compact
                tone="danger"
              />
            </section>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-base font-semibold text-amateur-ink">
                      {t('pages.communications.audienceTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-amateur-muted">{t('pages.communications.audienceHint')}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setGroupId('');
                      setTeamId('');
                      setCoachId('');
                      setFinancialState('');
                      setPrivateLessonStatus('');
                      setTrainingSessionId('');
                      setPrimaryContactsOnly(false);
                      setQuery('');
                    }}
                  >
                    {t('app.actions.clear')}
                  </Button>
                </div>

                {audience.items.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState title={t('pages.communications.empty')} hint={t('pages.communications.emptyHint')} />
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {audience.items.map((item) => (
                      <article key={item.athleteId} className="rounded-xl border border-amateur-border bg-amateur-surface px-4 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-amateur-ink">{item.athleteName}</p>
                            <p className="mt-1 text-xs text-amateur-muted">
                              {[item.groupName, ...item.teamNames].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                          <div className="text-right text-xs text-amateur-muted">
                            <p>
                              {t('pages.communications.reasonsLabel')}: {item.reasons.join(', ')}
                            </p>
                            <p>
                              {t('pages.communications.overdueLabel')}: {item.overdueAmount}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {item.guardians.length === 0 ? (
                            <p className="text-sm text-amateur-muted">{t('pages.communications.noGuardians')}</p>
                          ) : (
                            item.guardians.map((guardian) => (
                              <div key={guardian.guardianId} className="rounded-lg border border-amateur-border/70 bg-amateur-canvas px-3 py-2 text-sm">
                                <p className="font-medium text-amateur-ink">
                                  {guardian.name}
                                  {guardian.isPrimaryContact ? ` · ${t('pages.athletes.primaryContact')}` : ''}
                                </p>
                                <p className="text-xs text-amateur-muted">
                                  {[guardian.relationshipType, guardian.phone, guardian.email].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                  <h2 className="font-display text-base font-semibold text-amateur-ink">
                    {t('pages.communications.draftTitle')}
                  </h2>
                  <p className="mt-1 text-sm text-amateur-muted">{t('pages.communications.draftHint')}</p>
                  <div className="mt-4 space-y-3">
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.communications.draftSubject')}</span>
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span>{t('pages.communications.draftBodyLabel')}</span>
                      <textarea
                        value={draftBody}
                        onChange={(e) => setDraftBody(e.target.value)}
                        rows={8}
                        className="resize-y rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-semibold text-amateur-ink">
                        {t('pages.communications.contactListTitle')}
                      </h2>
                      <p className="mt-1 text-sm text-amateur-muted">{t('pages.communications.contactListHint')}</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(contactLines.join('\n'));
                      }}
                      disabled={contactLines.length === 0}
                    >
                      {t('pages.communications.copyContacts')}
                    </Button>
                  </div>
                  {contactLines.length === 0 ? (
                    <p className="mt-4 text-sm text-amateur-muted">{t('pages.communications.noContactLines')}</p>
                  ) : (
                    <div className="mt-4 max-h-72 overflow-auto rounded-xl border border-amateur-border bg-amateur-surface p-3">
                      <pre className="whitespace-pre-wrap text-xs text-amateur-ink">{contactLines.join('\n')}</pre>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </ListPageFrame>
    </div>
  );
}
