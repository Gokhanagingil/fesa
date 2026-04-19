import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { InlineAlert } from '../components/ui/InlineAlert';
import { ListPageFrame } from '../components/ui/ListPageFrame';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { apiGet } from '../lib/api';
import {
  formatDateTime,
  getAthleteStatusLabel,
  getCoachName,
  getCommunicationChannelLabel,
  getCommunicationSourceLabel,
  getFamilyReadinessStatusLabel,
  getFamilyReadinessTone,
  getPersonName,
  getPrivateLessonReasonLabel,
} from '../lib/display';
import {
  attemptOutreachDelivery,
  buildMailtoLink,
  buildPhoneLink,
  buildTokenContext,
  buildWhatsAppLink,
  buildWhatsAppShareLink,
  classifyMemberReach,
  countReachable,
  describeActivityAge,
  extractTokens,
  getCommunicationReadiness,
  getOutreach,
  isOutreachStale,
  isReachableForChannel,
  listOutreach,
  logOutreach,
  pickBestGuardian,
  renderTemplate,
  resolvePreferredDeliveryMode,
  setOutreachStatus,
  updateOutreach,
} from '../lib/communication';
import { useTenant } from '../lib/tenant-hooks';
import type {
  AthleteStatus,
  ClubGroup,
  Coach,
  CommunicationAudienceMember,
  CommunicationAudienceResponse,
  CommunicationChannel,
  CommunicationReadinessResponse,
  CommunicationTemplate,
  CommunicationTemplatesResponse,
  CommunicationTemplateToken,
  DeliveryMode,
  DeliveryState,
  FamilyReadinessStatus,
  OutreachActivity,
  OutreachActivityListResponse,
  OutreachStatus,
  Team,
  TrainingSession,
} from '../lib/domain-types';

type AudienceSourceContext = {
  surface: string;
  key?: string | null;
  hint?: string | null;
};

type AudienceFilterSnapshot = {
  q?: string;
  groupId?: string;
  teamId?: string;
  coachId?: string;
  athleteStatus?: AthleteStatus;
  financialState?: string;
  privateLessonStatus?: string;
  trainingSessionId?: string;
  portalEnabledOnly?: boolean;
  portalPendingOnly?: boolean;
  familyReadiness?: FamilyReadinessStatus;
  needsFollowUp?: boolean;
  primaryContactsOnly?: boolean;
  athleteIds?: string[];
  guardianIds?: string[];
};

type QuickScenario = {
  id: string;
  labelKey: string;
  hintKey: string;
  templateKey: string;
  channel: CommunicationChannel;
  filters: Record<string, string>;
  topicKey: string;
  source: AudienceSourceContext;
};

const QUICK_SCENARIOS: QuickScenario[] = [
  {
    id: 'overdue-payment',
    labelKey: 'pages.communications.quickScenarios.overduePayment',
    hintKey: 'pages.communications.quickScenarios.overduePaymentHint',
    templateKey: 'overdue_payment_reminder',
    channel: 'whatsapp',
    filters: { financialState: 'overdue', primaryContactsOnly: 'true' },
    topicKey: 'pages.communications.templates.overduePayment.title',
    source: { surface: 'finance_overdue' },
  },
  {
    id: 'family-follow-up',
    labelKey: 'pages.communications.quickScenarios.needsFollowUp',
    hintKey: 'pages.communications.quickScenarios.needsFollowUpHint',
    templateKey: 'family_follow_up',
    channel: 'whatsapp',
    filters: { needsFollowUp: 'true', primaryContactsOnly: 'true' },
    topicKey: 'pages.communications.templates.familyFollowUp.title',
    source: { surface: 'communications', key: 'needs_follow_up' },
  },
  {
    id: 'attendance-quiet',
    labelKey: 'pages.communications.quickScenarios.attendanceQuiet',
    hintKey: 'pages.communications.quickScenarios.attendanceQuietHint',
    templateKey: 'attendance_check_in',
    channel: 'whatsapp',
    filters: { athleteStatus: 'active', primaryContactsOnly: 'true' },
    topicKey: 'pages.communications.templates.attendanceCheckIn.title',
    source: { surface: 'attendance_quiet' },
  },
  {
    id: 'trial-follow-up',
    labelKey: 'pages.communications.quickScenarios.trialFollowUp',
    hintKey: 'pages.communications.quickScenarios.trialFollowUpHint',
    templateKey: 'trial_warm_follow_up',
    channel: 'whatsapp',
    filters: { athleteStatus: 'trial', primaryContactsOnly: 'true' },
    topicKey: 'pages.communications.templates.trialFollowUp.title',
    source: { surface: 'trial_high_engagement' },
  },
  {
    id: 'session-reminder',
    labelKey: 'pages.communications.quickScenarios.sessionReminder',
    hintKey: 'pages.communications.quickScenarios.sessionReminderHint',
    templateKey: 'session_reminder',
    channel: 'whatsapp',
    filters: { primaryContactsOnly: 'true' },
    topicKey: 'pages.communications.templates.sessionReminder.title',
    source: { surface: 'session_reminder' },
  },
  {
    id: 'group-announcement',
    labelKey: 'pages.communications.quickScenarios.groupAnnouncement',
    hintKey: 'pages.communications.quickScenarios.groupAnnouncementHint',
    templateKey: 'group_announcement',
    channel: 'whatsapp',
    filters: { primaryContactsOnly: 'true' },
    topicKey: 'pages.communications.templates.groupAnnouncement.title',
    source: { surface: 'group_announcement' },
  },
];

const CHANNEL_TONE: Record<CommunicationChannel, string> = {
  whatsapp: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  phone: 'bg-sky-100 text-sky-700 border-sky-200',
  email: 'bg-violet-100 text-violet-700 border-violet-200',
  manual: 'bg-slate-100 text-slate-700 border-slate-200',
};

/** Lightweight default tone for a "blank" preview when no recipient is selected. */
function previewWithoutRecipient(template: string): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, '—');
}

const STATUS_TONE: Record<OutreachStatus, string> = {
  draft: 'border-amber-200 bg-amber-50 text-amber-800',
  logged: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  archived: 'border-slate-200 bg-slate-50 text-slate-600',
};

const DELIVERY_MODE_TONE: Record<DeliveryMode, string> = {
  assisted: 'border-amateur-border bg-amateur-surface text-amateur-muted',
  direct: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const DELIVERY_STATE_TONE: Record<DeliveryState, string> = {
  prepared: 'border-amateur-border bg-amateur-surface text-amateur-muted',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
  fallback: 'border-amber-200 bg-amber-50 text-amber-800',
};

export function CommunicationsPage() {
  const { t, i18n } = useTranslation();
  const { tenantId, loading: tenantLoading } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [groupId, setGroupId] = useState(searchParams.get('groupId') ?? '');
  const [teamId, setTeamId] = useState(searchParams.get('teamId') ?? '');
  const [coachId, setCoachId] = useState(searchParams.get('coachId') ?? '');
  const [athleteStatus, setAthleteStatus] = useState<AthleteStatus | ''>(
    (searchParams.get('athleteStatus') as AthleteStatus | null) ?? '',
  );
  const [financialState, setFinancialState] = useState(searchParams.get('financialState') ?? '');
  const [privateLessonStatus, setPrivateLessonStatus] = useState(searchParams.get('privateLessonStatus') ?? '');
  const [trainingSessionId, setTrainingSessionId] = useState(searchParams.get('trainingSessionId') ?? '');
  const [portalEnabledOnly, setPortalEnabledOnly] = useState(searchParams.get('portalEnabledOnly') === 'true');
  const [portalPendingOnly, setPortalPendingOnly] = useState(searchParams.get('portalPendingOnly') === 'true');
  const [familyReadiness, setFamilyReadiness] = useState<FamilyReadinessStatus | ''>(
    (searchParams.get('familyReadiness') as FamilyReadinessStatus | null) ?? '',
  );
  const [needsFollowUp, setNeedsFollowUp] = useState(searchParams.get('needsFollowUp') === 'true');
  const [primaryContactsOnly, setPrimaryContactsOnly] = useState(searchParams.get('primaryContactsOnly') === 'true');
  const [athleteIds, setAthleteIds] = useState<string[]>(searchParams.getAll('athleteIds').filter(Boolean));
  const [guardianIds, setGuardianIds] = useState<string[]>(searchParams.getAll('guardianIds').filter(Boolean));
  const [showFilters, setShowFilters] = useState(false);
  const [tab, setTab] = useState<'draft' | 'history'>('draft');

  const initialChannel = (searchParams.get('channel') as CommunicationChannel | null) ?? 'whatsapp';
  const initialTemplate = searchParams.get('template') ?? null;
  const initialSourceSurface = searchParams.get('source') ?? 'manual';
  const initialSourceKey = searchParams.get('sourceKey');

  const [channel, setChannel] = useState<CommunicationChannel>(initialChannel);
  const [templateKey, setTemplateKey] = useState<string | null>(initialTemplate);
  const [draftTopic, setDraftTopic] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [audienceSource, setAudienceSource] = useState<AudienceSourceContext>({
    surface: initialSourceSurface,
    key: initialSourceKey,
  });

  const [groups, setGroups] = useState<ClubGroup[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [audience, setAudience] = useState<CommunicationAudienceResponse | null>(null);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [tokens, setTokens] = useState<CommunicationTemplateToken[]>([]);
  const [history, setHistory] = useState<OutreachActivityListResponse | null>(null);
  const [historyStatus, setHistoryStatus] = useState<'all' | OutreachStatus>('all');
  const [historyTemplate, setHistoryTemplate] = useState<string>('');
  const [historyChannel, setHistoryChannel] = useState<string>('');
  const [historySource, setHistorySource] = useState<string>('');
  const [staleAfterDays, setStaleAfterDays] = useState<number>(5);
  const [reachableOnly, setReachableOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingOutreach, setSavingOutreach] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [revealAllRecipients, setRevealAllRecipients] = useState(false);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftStatus, setActiveDraftStatus] = useState<OutreachStatus>('draft');
  const [readiness, setReadiness] = useState<CommunicationReadinessResponse | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [deliveryAttemptState, setDeliveryAttemptState] = useState<DeliveryState | null>(null);
  const [deliveryNotice, setDeliveryNotice] = useState<string | null>(null);
  const [deliveryCounts, setDeliveryCounts] = useState<{ sent: number; failed: number; attempted: number } | null>(
    null,
  );
  const [sendingDirect, setSendingDirect] = useState(false);

  useEffect(() => {
    setQuery(searchParams.get('q') ?? '');
    setGroupId(searchParams.get('groupId') ?? '');
    setTeamId(searchParams.get('teamId') ?? '');
    setCoachId(searchParams.get('coachId') ?? '');
    setAthleteStatus((searchParams.get('athleteStatus') as AthleteStatus | null) ?? '');
    setFinancialState(searchParams.get('financialState') ?? '');
    setPrivateLessonStatus(searchParams.get('privateLessonStatus') ?? '');
    setTrainingSessionId(searchParams.get('trainingSessionId') ?? '');
    setPortalEnabledOnly(searchParams.get('portalEnabledOnly') === 'true');
    setPortalPendingOnly(searchParams.get('portalPendingOnly') === 'true');
    setFamilyReadiness((searchParams.get('familyReadiness') as FamilyReadinessStatus | null) ?? '');
    setNeedsFollowUp(searchParams.get('needsFollowUp') === 'true');
    setPrimaryContactsOnly(searchParams.get('primaryContactsOnly') === 'true');
    setAthleteIds(searchParams.getAll('athleteIds').filter(Boolean));
    setGuardianIds(searchParams.getAll('guardianIds').filter(Boolean));
    setAudienceSource({
      surface: searchParams.get('source') ?? 'manual',
      key: searchParams.get('sourceKey'),
    });
    const incomingTemplate = searchParams.get('template');
    if (incomingTemplate) {
      setTemplateKey(incomingTemplate);
    }
    const incomingChannel = searchParams.get('channel') as CommunicationChannel | null;
    if (incomingChannel) {
      setChannel(incomingChannel);
    }
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (query.trim()) next.set('q', query.trim());
    if (groupId) next.set('groupId', groupId);
    if (teamId) next.set('teamId', teamId);
    if (coachId) next.set('coachId', coachId);
    if (athleteStatus) next.set('athleteStatus', athleteStatus);
    if (financialState) next.set('financialState', financialState);
    if (privateLessonStatus) next.set('privateLessonStatus', privateLessonStatus);
    if (trainingSessionId) next.set('trainingSessionId', trainingSessionId);
    if (portalEnabledOnly) next.set('portalEnabledOnly', 'true');
    if (portalPendingOnly) next.set('portalPendingOnly', 'true');
    if (familyReadiness) next.set('familyReadiness', familyReadiness);
    if (needsFollowUp) next.set('needsFollowUp', 'true');
    if (primaryContactsOnly) next.set('primaryContactsOnly', 'true');
    athleteIds.forEach((athleteId) => next.append('athleteIds', athleteId));
    guardianIds.forEach((id) => next.append('guardianIds', id));
    if (channel && channel !== 'whatsapp') next.set('channel', channel);
    if (templateKey) next.set('template', templateKey);
    if (audienceSource.surface && audienceSource.surface !== 'manual') {
      next.set('source', audienceSource.surface);
    }
    if (audienceSource.key) next.set('sourceKey', audienceSource.key);
    setSearchParams(next, { replace: true });
  }, [
    athleteIds,
    athleteStatus,
    audienceSource.key,
    audienceSource.surface,
    channel,
    coachId,
    familyReadiness,
    financialState,
    groupId,
    guardianIds,
    needsFollowUp,
    portalEnabledOnly,
    portalPendingOnly,
    primaryContactsOnly,
    privateLessonStatus,
    query,
    setSearchParams,
    teamId,
    templateKey,
    trainingSessionId,
  ]);

  useEffect(() => {
    if (!tenantId) return;
    void (async () => {
      try {
        const [groupRes, teamRes, coachRes, sessionRes, templatesRes] = await Promise.all([
          apiGet<{ items: ClubGroup[] }>('/api/groups?limit=200'),
          apiGet<{ items: Team[] }>('/api/teams?limit=200'),
          apiGet<{ items: Coach[] }>('/api/coaches?limit=200'),
          apiGet<{ items: TrainingSession[] }>('/api/training-sessions?limit=100'),
          apiGet<CommunicationTemplatesResponse>('/api/communications/templates'),
        ]);
        setGroups(groupRes.items);
        setTeams(teamRes.items);
        setCoaches(coachRes.items);
        setSessions(sessionRes.items);
        setTemplates(templatesRes.items);
        setTokens(templatesRes.tokens ?? []);
        if (typeof templatesRes.lifecycle?.staleAfterDays === 'number') {
          setStaleAfterDays(templatesRes.lifecycle.staleAfterDays);
        }
      } catch {
        setGroups([]);
        setTeams([]);
        setCoaches([]);
        setSessions([]);
        setTemplates([]);
        setTokens([]);
      }
    })();
  }, [tenantId]);

  const loadHistory = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await listOutreach({
        status: historyStatus === 'all' ? undefined : historyStatus,
      });
      setHistory(res);
    } catch {
      setHistory({
        items: [],
        counts: {
          total: 0,
          whatsapp: 0,
          phone: 0,
          email: 0,
          manual: 0,
          draft: 0,
          logged: 0,
          archived: 0,
        },
      });
    }
  }, [historyStatus, tenantId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!tenantId) {
      setReadiness(null);
      return;
    }
    let cancelled = false;
    setReadinessLoading(true);
    void getCommunicationReadiness(channel)
      .then((res) => {
        if (!cancelled) setReadiness(res);
      })
      .catch(() => {
        if (!cancelled) setReadiness(null);
      })
      .finally(() => {
        if (!cancelled) setReadinessLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [channel, tenantId]);

  const preferredMode: DeliveryMode = useMemo(
    () => resolvePreferredDeliveryMode(readiness, channel),
    [channel, readiness],
  );

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
      if (athleteStatus) params.set('athleteStatus', athleteStatus);
      if (financialState) params.set('financialState', financialState);
      if (privateLessonStatus) params.set('privateLessonStatus', privateLessonStatus);
      if (trainingSessionId) params.set('trainingSessionId', trainingSessionId);
      if (portalEnabledOnly) params.set('portalEnabledOnly', 'true');
      if (portalPendingOnly) params.set('portalPendingOnly', 'true');
      if (familyReadiness) params.set('familyReadiness', familyReadiness);
      if (needsFollowUp) params.set('needsFollowUp', 'true');
      if (primaryContactsOnly) params.set('primaryContactsOnly', 'true');
      athleteIds.forEach((athleteId) => params.append('athleteIds', athleteId));
      guardianIds.forEach((id) => params.append('guardianIds', id));
      const res = await apiGet<CommunicationAudienceResponse>(
        `/api/communications/audiences?${params.toString()}`,
      );
      setAudience(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [
    athleteIds,
    athleteStatus,
    coachId,
    familyReadiness,
    financialState,
    groupId,
    guardianIds,
    needsFollowUp,
    portalEnabledOnly,
    portalPendingOnly,
    primaryContactsOnly,
    privateLessonStatus,
    query,
    t,
    teamId,
    tenantId,
    trainingSessionId,
  ]);

  useEffect(() => {
    const id = setTimeout(() => void loadAudience(), 200);
    return () => clearTimeout(id);
  }, [loadAudience]);

  const activeTemplate = useMemo(
    () => templates.find((template) => template.key === templateKey) ?? null,
    [templateKey, templates],
  );

  useEffect(() => {
    if (activeDraftId) return;
    if (!activeTemplate) {
      if (!draftHydrated) {
        setDraftTopic(t('pages.communications.templates.familyFollowUp.title'));
        setDraftBody(t('pages.communications.templates.familyFollowUp.body'));
        setDraftSubject(t('pages.communications.templates.familyFollowUp.subject'));
        setDraftHydrated(true);
      }
      return;
    }
    setDraftTopic(t(activeTemplate.titleKey));
    setDraftBody(t(activeTemplate.bodyKey));
    setDraftSubject(activeTemplate.subjectKey ? t(activeTemplate.subjectKey) : '');
    setDraftHydrated(true);
  }, [activeDraftId, activeTemplate, draftHydrated, t]);

  const visibleTeams = useMemo(
    () => (groupId ? teams.filter((team) => team.groupId === groupId) : teams),
    [groupId, teams],
  );

  const reachable = useMemo(() => countReachable(audience, channel), [audience, channel]);

  const trainingSession = useMemo(
    () => sessions.find((s) => s.id === trainingSessionId) ?? null,
    [sessions, trainingSessionId],
  );
  const tokenExtras = useMemo(() => {
    const fallbackCoach = coachId
      ? coaches.find((coach) => coach.id === coachId)
      : trainingSession?.coachId
        ? coaches.find((coach) => coach.id === trainingSession.coachId)
        : null;
    const coachName = fallbackCoach ? getCoachName(fallbackCoach) : null;
    return {
      coachName: coachName && coachName !== '—' ? coachName : null,
      branchName: null as string | null,
      sessionLocation: trainingSession?.location ?? null,
      nextSession: trainingSession
        ? formatDateTime(trainingSession.scheduledStart, i18n.language)
        : null,
      clubName: audience?.meta?.clubName ?? null,
    };
  }, [audience?.meta?.clubName, coachId, coaches, i18n.language, trainingSession]);

  const recipientPlan = useMemo(() => {
    if (!audience) return [];
    return audience.items.map((member) => {
      const guardian = pickBestGuardian(member, channel);
      const ctx = buildTokenContext(member, tokenExtras);
      const rendered = renderTemplate(draftBody, ctx);
      const personalizedMessage = rendered.text;
      const link =
        channel === 'whatsapp'
          ? buildWhatsAppLink(guardian?.phone ?? null, personalizedMessage)
          : channel === 'phone'
            ? buildPhoneLink(guardian?.phone ?? null)
            : channel === 'email'
              ? buildMailtoLink(guardian?.email ?? null, draftSubject || draftTopic, personalizedMessage)
              : null;
      return {
        member,
        guardian,
        personalizedMessage,
        missingTokens: rendered.missing,
        link,
        reachable: Boolean(guardian),
      };
    });
  }, [audience, channel, draftBody, draftSubject, draftTopic, tokenExtras]);

  const usedTokens = useMemo(() => extractTokens(draftBody), [draftBody]);
  const aggregatedMissingTokens = useMemo(() => {
    const set = new Set<string>();
    recipientPlan.forEach((row) => row.missingTokens.forEach((token) => set.add(token)));
    return Array.from(set);
  }, [recipientPlan]);

  const reachableRecipients = useMemo(
    () => recipientPlan.filter((row) => row.reachable),
    [recipientPlan],
  );

  const filteredRecipients = useMemo(
    () => (reachableOnly ? reachableRecipients : recipientPlan),
    [reachableOnly, reachableRecipients, recipientPlan],
  );

  const visibleRecipients = useMemo(
    () => (revealAllRecipients ? filteredRecipients : filteredRecipients.slice(0, 8)),
    [filteredRecipients, revealAllRecipients],
  );

  const activeDraft = useMemo(() => {
    if (!activeDraftId || !history) return null;
    return history.items.find((row) => row.id === activeDraftId) ?? null;
  }, [activeDraftId, history]);

  const showStaleDraftHint = useMemo(
    () =>
      activeDraftStatus === 'draft' && activeDraft
        ? isOutreachStale(activeDraft, staleAfterDays)
        : false,
    [activeDraft, activeDraftStatus, staleAfterDays],
  );

  const filteredHistoryItems = useMemo(() => {
    if (!history) return [] as OutreachActivity[];
    return history.items.filter((item) => {
      if (historyTemplate && item.templateKey !== historyTemplate) return false;
      if (historyChannel && item.channel !== historyChannel) return false;
      if (historySource && item.sourceSurface !== historySource) return false;
      return true;
    });
  }, [history, historyChannel, historySource, historyTemplate]);

  const historyTemplateOptions = useMemo(() => {
    if (!history) return [] as string[];
    return Array.from(
      new Set(
        history.items
          .map((row) => row.templateKey)
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }, [history]);

  const historyChannelOptions = useMemo(() => {
    if (!history) return [] as string[];
    return Array.from(new Set(history.items.map((row) => row.channel))).filter(Boolean);
  }, [history]);

  const historySourceOptions = useMemo(() => {
    if (!history) return [] as string[];
    return Array.from(new Set(history.items.map((row) => row.sourceSurface))).filter(Boolean);
  }, [history]);

  const staleDraftCount = useMemo(() => {
    if (!history) return 0;
    return history.items.filter((row) => isOutreachStale(row, staleAfterDays)).length;
  }, [history, staleAfterDays]);

  const contactLines = useMemo(() => {
    return recipientPlan.flatMap((row) =>
      row.member.guardians.map(
        (guardian) =>
          `${row.member.athleteName} · ${guardian.name} · ${guardian.phone || guardian.email || '—'}`,
      ),
    );
  }, [recipientPlan]);

  const perFamilyMessages = useMemo(() => {
    return recipientPlan
      .map((row) => {
        const guardianName = row.guardian?.name ?? row.member.guardians[0]?.name ?? '—';
        const phone = row.guardian?.phone ?? '—';
        return `## ${row.member.athleteName} (${guardianName} · ${phone})\n${row.personalizedMessage}`;
      })
      .join('\n\n');
  }, [recipientPlan]);

  const handleApplyTemplate = useCallback(
    (template: CommunicationTemplate | null) => {
      setTemplateKey(template?.key ?? null);
      if (template) {
        setChannel(template.defaultChannel);
        setDraftTopic(t(template.titleKey));
        setDraftBody(t(template.bodyKey));
        setDraftSubject(template.subjectKey ? t(template.subjectKey) : '');
        setDraftHydrated(true);
      }
    },
    [t],
  );

  const handleApplyScenario = useCallback(
    (scenario: QuickScenario) => {
      setQuery('');
      setGroupId(scenario.filters.groupId ?? '');
      setTeamId(scenario.filters.teamId ?? '');
      setCoachId(scenario.filters.coachId ?? '');
      setAthleteStatus((scenario.filters.athleteStatus as AthleteStatus | undefined) ?? '');
      setFinancialState(scenario.filters.financialState ?? '');
      setPrivateLessonStatus(scenario.filters.privateLessonStatus ?? '');
      setTrainingSessionId(scenario.filters.trainingSessionId ?? '');
      setPortalEnabledOnly(scenario.filters.portalEnabledOnly === 'true');
      setPortalPendingOnly(scenario.filters.portalPendingOnly === 'true');
      setFamilyReadiness((scenario.filters.familyReadiness as FamilyReadinessStatus | undefined) ?? '');
      setNeedsFollowUp(scenario.filters.needsFollowUp === 'true');
      setPrimaryContactsOnly(scenario.filters.primaryContactsOnly !== 'false');
      setAthleteIds([]);
      setAudienceSource(scenario.source);
      setChannel(scenario.channel);
      const template = templates.find((item) => item.key === scenario.templateKey) ?? null;
      handleApplyTemplate(template);
      setDraftTopic(t(scenario.topicKey));
      setTab('draft');
    },
    [handleApplyTemplate, t, templates],
  );

  const handleClearAudience = useCallback(() => {
    setQuery('');
    setGroupId('');
    setTeamId('');
    setCoachId('');
    setAthleteStatus('');
    setFinancialState('');
    setPrivateLessonStatus('');
    setTrainingSessionId('');
    setPortalEnabledOnly(false);
    setPortalPendingOnly(false);
    setFamilyReadiness('');
    setNeedsFollowUp(false);
    setPrimaryContactsOnly(false);
    setAthleteIds([]);
    setGuardianIds([]);
    setAudienceSource({ surface: 'manual' });
  }, []);

  const audienceFilters = useMemo<AudienceFilterSnapshot>(
    () => ({
      ...(query.trim() ? { q: query.trim() } : {}),
      ...(groupId ? { groupId } : {}),
      ...(teamId ? { teamId } : {}),
      ...(coachId ? { coachId } : {}),
      ...(athleteStatus ? { athleteStatus } : {}),
      ...(financialState ? { financialState } : {}),
      ...(privateLessonStatus ? { privateLessonStatus } : {}),
      ...(trainingSessionId ? { trainingSessionId } : {}),
      ...(portalEnabledOnly ? { portalEnabledOnly: true } : {}),
      ...(portalPendingOnly ? { portalPendingOnly: true } : {}),
      ...(familyReadiness ? { familyReadiness } : {}),
      ...(needsFollowUp ? { needsFollowUp: true } : {}),
      ...(primaryContactsOnly ? { primaryContactsOnly: true } : {}),
      ...(athleteIds.length > 0 ? { athleteIds } : {}),
      ...(guardianIds.length > 0 ? { guardianIds } : {}),
    }),
    [
      athleteIds,
      athleteStatus,
      coachId,
      familyReadiness,
      financialState,
      groupId,
      guardianIds,
      needsFollowUp,
      portalEnabledOnly,
      portalPendingOnly,
      primaryContactsOnly,
      privateLessonStatus,
      query,
      teamId,
      trainingSessionId,
    ],
  );

  const persistOutreach = useCallback(
    async (status: OutreachStatus): Promise<OutreachActivity | null> => {
      if (!audience) return null;
      setSavingOutreach(true);
      setSavedNotice(null);
      try {
        const guardianIds = audience.items
          .flatMap((item) => item.guardians.map((guardian) => guardian.guardianId))
          .filter(Boolean);
        const audienceSummary = {
          athletes: audience.counts.athletes,
          guardians: audience.counts.guardians,
          primaryContacts: audience.counts.primaryContacts,
          withOverdueBalance: audience.counts.withOverdueBalance,
          needingFollowUp: audience.counts.needingFollowUp,
          contextLabel: getCommunicationSourceLabel(t, audienceSource.surface, audienceSource.key),
        };
        const payload = {
          channel,
          status,
          sourceSurface: audienceSource.surface,
          sourceKey: audienceSource.key ?? undefined,
          templateKey: templateKey ?? undefined,
          topic: draftTopic.trim() || t('pages.communications.templates.familyFollowUp.title'),
          messagePreview: draftBody.trim().slice(0, 4000) || undefined,
          athleteIds: audience.items.map((item) => item.athleteId),
          guardianIds,
          audienceFilters,
          recipientCount: audience.counts.athletes,
          reachableGuardianCount: reachable.guardians,
          audienceSummary,
          note: draftNote.trim() || undefined,
        };
        const saved = activeDraftId
          ? await updateOutreach(activeDraftId, payload)
          : await logOutreach(payload);
        setActiveDraftId(saved.id);
        setActiveDraftStatus((saved.status as OutreachStatus) ?? status);
        setSavedNotice(
          status === 'draft'
            ? t('pages.communications.actions.draftSaved')
            : t('pages.communications.actions.saved'),
        );
        await loadHistory();
        return saved;
      } catch (e) {
        setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
        return null;
      } finally {
        setSavingOutreach(false);
      }
    },
    [
      activeDraftId,
      audience,
      audienceFilters,
      audienceSource.key,
      audienceSource.surface,
      channel,
      draftBody,
      draftNote,
      draftTopic,
      loadHistory,
      reachable.guardians,
      t,
      templateKey,
    ],
  );

  const handleLogOutreach = useCallback(() => persistOutreach('logged'), [persistOutreach]);
  const handleSaveDraft = useCallback(() => persistOutreach('draft'), [persistOutreach]);

  const handleSendDirect = useCallback(async () => {
    if (!audience || audience.items.length === 0) return;
    setSendingDirect(true);
    setDeliveryNotice(null);
    setDeliveryAttemptState(null);
    try {
      // Make sure we have a persisted row to attach delivery state to.
      let targetId = activeDraftId;
      if (!targetId) {
        const saved = await persistOutreach('logged');
        targetId = saved?.id ?? null;
      }
      if (!targetId) {
        setDeliveryAttemptState('fallback');
        setDeliveryNotice(t('pages.communications.delivery.actions.directFallback'));
        return;
      }

      const recipients = recipientPlan
        .filter((row) => row.guardian)
        .map((row) => ({
          athleteId: row.member.athleteId,
          athleteName: row.member.athleteName,
          guardianId: row.guardian?.guardianId ?? null,
          guardianName: row.guardian?.name ?? null,
          phone: row.guardian?.phone ?? null,
          email: row.guardian?.email ?? null,
          message: row.personalizedMessage,
          subject: draftSubject || draftTopic || null,
        }));

      if (recipients.length === 0) {
        setDeliveryAttemptState('fallback');
        setDeliveryNotice(t('pages.communications.delivery.actions.directFallback'));
        return;
      }

      const result = await attemptOutreachDelivery(targetId, {
        mode: 'direct',
        recipients,
      });
      const next = result.delivery?.state ?? 'prepared';
      setDeliveryAttemptState(next);
      const counts = result.delivery?.attemptCounts ?? null;
      setDeliveryCounts(
        counts
          ? { sent: counts.sent, failed: counts.failed, attempted: counts.attempted }
          : null,
      );
      if (next === 'sent') {
        const sentCount = counts?.sent ?? recipients.length;
        const failedCount = counts?.failed ?? 0;
        if (failedCount > 0) {
          setDeliveryNotice(
            t('pages.communications.delivery.actions.directPartial', {
              sent: sentCount,
              total: counts?.attempted ?? recipients.length,
            }),
          );
        } else {
          setDeliveryNotice(
            t('pages.communications.delivery.actions.directSent', { count: sentCount }),
          );
        }
      } else if (next === 'fallback') {
        setDeliveryNotice(t('pages.communications.delivery.actions.directFallback'));
      } else if (next === 'failed') {
        setDeliveryNotice(t('pages.communications.delivery.actions.directFailed'));
      }
      await loadHistory();
    } catch (e) {
      setDeliveryAttemptState('failed');
      setDeliveryCounts(null);
      setDeliveryNotice(
        e instanceof Error ? e.message : t('pages.communications.delivery.actions.directFailed'),
      );
    } finally {
      setSendingDirect(false);
    }
  }, [
    activeDraftId,
    audience,
    draftSubject,
    draftTopic,
    loadHistory,
    persistOutreach,
    recipientPlan,
    t,
  ]);

  const handleStartNewDraft = useCallback(() => {
    setActiveDraftId(null);
    setActiveDraftStatus('draft');
    setSavedNotice(null);
    setDraftNote('');
    setAudienceSource({ surface: 'manual' });
    handleClearAudience();
  }, [handleClearAudience]);

  const handleArchiveDraft = useCallback(async () => {
    if (!activeDraftId) return;
    try {
      await setOutreachStatus(activeDraftId, 'archived');
      setSavedNotice(t('pages.communications.actions.archived'));
      setActiveDraftStatus('archived');
      await loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
    }
  }, [activeDraftId, loadHistory, t]);

  const handleReopenActivity = useCallback(
    async (activity: OutreachActivity) => {
      try {
        const fresh = await getOutreach(activity.id);
        setActiveDraftId(fresh.id);
        setActiveDraftStatus((fresh.status as OutreachStatus) ?? 'draft');
        setChannel((fresh.channel as CommunicationChannel) ?? 'whatsapp');
        setTemplateKey(fresh.templateKey);
        setDraftTopic(fresh.topic);
        setDraftBody(fresh.messagePreview ?? '');
        setDraftNote(fresh.note ?? '');
        setDraftHydrated(true);
        const snapshot = (fresh.audienceSnapshot ?? {}) as {
          athleteIds?: string[];
          audienceFilters?: AudienceFilterSnapshot | null;
        };
        const savedFilters = snapshot.audienceFilters ?? null;
        setQuery(savedFilters?.q ?? '');
        setGroupId(savedFilters?.groupId ?? '');
        setTeamId(savedFilters?.teamId ?? '');
        setCoachId(savedFilters?.coachId ?? '');
        setAthleteStatus(savedFilters?.athleteStatus ?? '');
        setFinancialState(savedFilters?.financialState ?? '');
        setPrivateLessonStatus(savedFilters?.privateLessonStatus ?? '');
        setTrainingSessionId(savedFilters?.trainingSessionId ?? '');
        setPortalEnabledOnly(savedFilters?.portalEnabledOnly === true);
        setPortalPendingOnly(savedFilters?.portalPendingOnly === true);
        setFamilyReadiness(savedFilters?.familyReadiness ?? '');
        setNeedsFollowUp(savedFilters?.needsFollowUp === true);
        setPrimaryContactsOnly(savedFilters?.primaryContactsOnly === true);
        setAthleteIds(
          Array.isArray(savedFilters?.athleteIds)
            ? savedFilters.athleteIds
            : Array.isArray(snapshot.athleteIds)
              ? snapshot.athleteIds
              : [],
        );
        setGuardianIds(
          Array.isArray(savedFilters?.guardianIds)
            ? savedFilters.guardianIds
            : [],
        );
        setAudienceSource({ surface: fresh.sourceSurface, key: fresh.sourceKey });
        setTab('draft');
        setSavedNotice(
          fresh.status === 'draft'
            ? t('pages.communications.actions.draftReopened')
            : t('pages.communications.actions.followUpReopened'),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : t('app.errors.loadFailed'));
      }
    },
    [t],
  );

  const audienceSourceLabel = getCommunicationSourceLabel(
    t,
    audienceSource.surface,
    audienceSource.key,
  );

  const noPhoneFamilies = audience ? audience.counts.athletes - reachable.athletes : 0;

  const channelButtons = useMemo(() => {
    const channels: CommunicationChannel[] = ['whatsapp', 'phone', 'email', 'manual'];
    return channels.map((value) => ({
      value,
      label: getCommunicationChannelLabel(t, value),
      hint: t(`pages.communications.channelHint.${value}`),
    }));
  }, [t]);

  return (
    <div>
      <PageHeader
        title={t('pages.communications.title')}
        subtitle={t('pages.communications.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('draft')}
              aria-pressed={tab === 'draft'}
              className={`min-h-[40px] rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                tab === 'draft'
                  ? 'border-amateur-accent bg-amateur-accent-soft text-amateur-accent'
                  : 'border-amateur-border bg-amateur-surface text-amateur-muted hover:text-amateur-ink'
              }`}
            >
              {t('pages.communications.tabs.draft')}
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              aria-pressed={tab === 'history'}
              className={`min-h-[40px] rounded-full border px-4 py-1.5 text-xs font-medium transition ${
                tab === 'history'
                  ? 'border-amateur-accent bg-amateur-accent-soft text-amateur-accent'
                  : 'border-amateur-border bg-amateur-surface text-amateur-muted hover:text-amateur-ink'
              }`}
            >
              {t('pages.communications.tabs.history')}
            </button>
            <Button type="button" variant="ghost" onClick={() => void loadAudience()}>
              {t('app.actions.refresh')}
            </Button>
          </div>
        }
      />

      {error ? (
        <InlineAlert tone="error" className="mb-4">
          {error}
        </InlineAlert>
      ) : null}

      <section className="mb-4 rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amateur-muted">
              {t('pages.communications.quickScenarios.title')}
            </p>
            <h2 className="font-display text-base font-semibold text-amateur-ink">
              {t('pages.communications.quickScenarios.hint')}
            </h2>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {QUICK_SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => handleApplyScenario(scenario)}
              className="group flex h-full flex-col items-start rounded-xl border border-amateur-border bg-amateur-surface px-4 py-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/40"
            >
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                {t('pages.communications.channels.whatsapp')}
              </span>
              <p className="mt-2 font-medium text-amateur-ink">{t(scenario.labelKey)}</p>
              <p className="mt-1 text-xs text-amateur-muted">{t(scenario.hintKey)}</p>
            </button>
          ))}
        </div>
      </section>

      {tab === 'history' ? (
        <FollowUpHistory
          history={history}
          filteredItems={filteredHistoryItems}
          templates={templates}
          languageTag={i18n.language}
          statusFilter={historyStatus}
          onChangeStatusFilter={setHistoryStatus}
          templateFilter={historyTemplate}
          onChangeTemplateFilter={setHistoryTemplate}
          channelFilter={historyChannel}
          onChangeChannelFilter={setHistoryChannel}
          sourceFilter={historySource}
          onChangeSourceFilter={setHistorySource}
          templateOptions={historyTemplateOptions}
          channelOptions={historyChannelOptions}
          sourceOptions={historySourceOptions}
          staleAfterDays={staleAfterDays}
          staleDraftCount={staleDraftCount}
          onReopen={(activity) => void handleReopenActivity(activity)}
        />
      ) : (
        <ListPageFrame
          search={{
            value: query,
            onChange: setQuery,
            disabled: !tenantId || tenantLoading,
            placeholder: t('pages.communications.searchPlaceholder'),
          }}
          toolbarLabel={t('app.actions.filter')}
          toolbar={
            <>
              <Button type="button" variant="ghost" onClick={() => setShowFilters((value) => !value)}>
                {showFilters ? t('app.actions.hide') : t('app.actions.filter')}
              </Button>
              <Button type="button" variant="ghost" onClick={handleClearAudience}>
                {t('app.actions.clear')}
              </Button>
            </>
          }
        >
          {showFilters ? (
            <FiltersPanel
              athleteStatus={athleteStatus}
              coachId={coachId}
              coaches={coaches}
              familyReadiness={familyReadiness}
              financialState={financialState}
              groupId={groupId}
              groups={groups}
              needsFollowUp={needsFollowUp}
              portalEnabledOnly={portalEnabledOnly}
              portalPendingOnly={portalPendingOnly}
              primaryContactsOnly={primaryContactsOnly}
              privateLessonStatus={privateLessonStatus}
              sessions={sessions}
              setAthleteStatus={setAthleteStatus}
              setCoachId={setCoachId}
              setFamilyReadiness={setFamilyReadiness}
              setFinancialState={setFinancialState}
              setGroupId={(value) => {
                setGroupId(value);
                setTeamId('');
              }}
              setNeedsFollowUp={setNeedsFollowUp}
              setPortalEnabledOnly={setPortalEnabledOnly}
              setPortalPendingOnly={setPortalPendingOnly}
              setPrimaryContactsOnly={setPrimaryContactsOnly}
              setPrivateLessonStatus={setPrivateLessonStatus}
              setTeamId={setTeamId}
              setTrainingSessionId={setTrainingSessionId}
              teamId={teamId}
              trainingSessionId={trainingSessionId}
              visibleTeams={visibleTeams}
            />
          ) : null}

          {!tenantId && !tenantLoading ? (
            <p className="text-sm text-amateur-muted">{t('app.errors.needTenant')}</p>
          ) : loading && !audience ? (
            <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>
          ) : !audience ? (
            <EmptyState
              title={t('pages.communications.empty')}
              hint={t('pages.communications.emptyHint')}
            />
          ) : (
            <div className="space-y-6">
              <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amateur-muted">
                      {t('pages.communications.audience.sourceLabel')}
                    </p>
                    <h2 className="mt-1 font-display text-base font-semibold text-amateur-ink">
                      {audienceSourceLabel}
                    </h2>
                    <p className="mt-1 text-sm text-amateur-muted">
                      {t('pages.communications.audience.summary', {
                        athletes: audience.counts.athletes,
                        guardians: audience.counts.guardians,
                        primary: audience.counts.primaryContacts,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-amateur-muted">
                      {t('pages.communications.audience.reachSummary', {
                        reachableAthletes: reachable.athletes,
                        totalAthletes: audience.counts.athletes,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      {t('pages.communications.audience.phoneReachable', {
                        count: reachable.guardians,
                      })}
                    </span>
                    {noPhoneFamilies > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                        {t('pages.communications.audience.phoneMissing', {
                          count: noPhoneFamilies,
                        })}
                      </span>
                    ) : null}
                    {(audience.counts.athletesUnreachable ?? 0) > 0 ? (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                        {t('pages.communications.audience.reachUnreachable', {
                          count: audience.counts.athletesUnreachable,
                        })}
                      </span>
                    ) : null}
                    {audience.counts.needingFollowUp > 0 ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                        {t('pages.communications.audience.needFollowUp', {
                          count: audience.counts.needingFollowUp,
                        })}
                      </span>
                    ) : null}
                  </div>
                </div>
                {audience.counts.athletes > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-amateur-border pt-3">
                    <label className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-amateur-border bg-amateur-surface px-3 py-1.5 text-xs font-medium text-amateur-muted">
                      <input
                        type="checkbox"
                        checked={reachableOnly}
                        onChange={(e) => setReachableOnly(e.target.checked)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span>{t('pages.communications.audience.reachableOnly')}</span>
                    </label>
                    {(audience.counts.athletesUnreachable ?? 0) === 0 ? (
                      <span className="text-xs text-amateur-muted">
                        {t('pages.communications.audience.reachAllReachable')}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard label={t('pages.communications.summaryAthletes')} value={audience.counts.athletes} compact />
                <StatCard
                  label={t('pages.communications.summaryReachWhatsApp')}
                  value={reachable.guardians}
                  compact
                  tone={reachable.guardians === 0 ? 'danger' : 'default'}
                />
                <StatCard
                  label={t('pages.communications.summaryReachEmail')}
                  value={audience.counts.guardiansWithEmail}
                  compact
                />
                <StatCard
                  label={t('pages.communications.summaryNeedsFollowUp')}
                  value={audience.counts.needingFollowUp}
                  compact
                  tone={audience.counts.needingFollowUp > 0 ? 'danger' : 'default'}
                />
              </section>

              {reachable.guardians === 0 && audience.counts.athletes > 0 ? (
                <InlineAlert tone="info">
                  {t('pages.communications.noPhoneWarning')}
                </InlineAlert>
              ) : null}

              {savedNotice ? <InlineAlert tone="info">{savedNotice}</InlineAlert> : null}

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-display text-base font-semibold text-amateur-ink">
                        {t('pages.communications.audience.title')}
                      </h2>
                      <p className="mt-1 text-sm text-amateur-muted">
                        {t('pages.communications.recipientList.hint')}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
                    {channelButtons.map((option) => {
                      const active = channel === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setChannel(option.value)}
                          className={`min-h-[40px] shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition sm:shrink ${
                            active
                              ? CHANNEL_TONE[option.value]
                              : 'border-amateur-border bg-amateur-surface text-amateur-muted hover:text-amateur-ink'
                          }`}
                          aria-pressed={active}
                        >
                          {option.label}
                          {option.value === 'whatsapp' ? ` · ${t('pages.communications.channelPrimary')}` : ''}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-amateur-muted">
                    {t(`pages.communications.channelHint.${channel}`)}
                  </p>

                  {audience.items.length === 0 ? (
                    <div className="mt-4">
                      <EmptyState
                        title={t('pages.communications.empty')}
                        hint={t('pages.communications.emptyFilteredHint')}
                      />
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {visibleRecipients.map((row) => (
                        <RecipientCard
                          key={row.member.athleteId}
                          channel={channel}
                          link={row.link}
                          member={row.member}
                          message={row.personalizedMessage}
                          missingTokens={row.missingTokens}
                          subject={draftSubject || draftTopic}
                        />
                      ))}
                      {filteredRecipients.length > visibleRecipients.length ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setRevealAllRecipients(true)}
                        >
                          {t('pages.communications.recipientList.showMore', {
                            count: filteredRecipients.length - visibleRecipients.length,
                          })}
                        </Button>
                      ) : revealAllRecipients && filteredRecipients.length > 8 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setRevealAllRecipients(false)}
                        >
                          {t('pages.communications.recipientList.showLess')}
                        </Button>
                      ) : null}
                    </div>
                  )}
                </section>

                <section className="space-y-4">
                  <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                    <h2 className="font-display text-base font-semibold text-amateur-ink">
                      {t('pages.communications.templatePickerTitle')}
                    </h2>
                    <p className="mt-1 text-sm text-amateur-muted">
                      {t('pages.communications.templatePickerHint')}
                    </p>
                    <div className="mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
                      <button
                        type="button"
                        onClick={() => handleApplyTemplate(null)}
                        className={`min-h-[40px] shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition sm:shrink ${
                          !templateKey
                            ? 'border-amateur-accent bg-amateur-accent-soft text-amateur-accent'
                            : 'border-amateur-border bg-amateur-surface text-amateur-muted hover:text-amateur-ink'
                        }`}
                      >
                        {t('pages.communications.templateNoneTitle')}
                      </button>
                      {templates.map((template) => (
                        <button
                          key={template.key}
                          type="button"
                          onClick={() => handleApplyTemplate(template)}
                          className={`min-h-[40px] shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition sm:shrink ${
                            templateKey === template.key
                              ? 'border-amateur-accent bg-amateur-accent-soft text-amateur-accent'
                              : 'border-amateur-border bg-amateur-surface text-amateur-muted hover:text-amateur-ink'
                          }`}
                        >
                          {t(template.titleKey)}
                        </button>
                      ))}
                    </div>
                    {activeTemplate?.hintKey ? (
                      <p className="mt-3 rounded-xl bg-amateur-surface px-3 py-2 text-xs text-amateur-muted">
                        {t(activeTemplate.hintKey)}
                      </p>
                    ) : (
                      <p className="mt-3 rounded-xl bg-amateur-surface px-3 py-2 text-xs text-amateur-muted">
                        {t('pages.communications.templateNoneHint')}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="font-display text-base font-semibold text-amateur-ink">
                          {t('pages.communications.draftPanel.title')}
                        </h2>
                        <p className="mt-1 text-sm text-amateur-muted">
                          {t('pages.communications.draftPanel.hint')}
                        </p>
                      </div>
                      {activeDraftId ? (
                        <div className="flex flex-col items-end gap-1">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[activeDraftStatus]}`}
                            title={
                              activeDraftStatus === 'draft'
                                ? t('pages.communications.lifecycle.draftBadge')
                                : activeDraftStatus === 'logged'
                                  ? t('pages.communications.lifecycle.loggedBadge')
                                  : t(`pages.communications.lifecycle.${activeDraftStatus}`)
                            }
                          >
                            {t(`pages.communications.lifecycle.${activeDraftStatus}`)}
                          </span>
                          {activeDraft ? (
                            <span className="text-[11px] text-amateur-muted">
                              {describeActivityAge(t, activeDraft)}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="rounded-full border border-amateur-border bg-amateur-surface px-2.5 py-0.5 text-[11px] font-medium text-amateur-muted">
                          {t('pages.communications.lifecycle.unsaved')}
                        </span>
                      )}
                    </div>
                    {showStaleDraftHint ? (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                        <p className="font-semibold">
                          {t('pages.communications.lifecycle.stillRelevant')}
                        </p>
                        <p className="mt-0.5 text-amber-800">
                          {t('pages.communications.lifecycle.stillRelevantHint')}
                        </p>
                      </div>
                    ) : null}
                    {tokens.length > 0 ? (
                      <div className="mt-3 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-amateur-muted">
                          {t('pages.communications.draftPanel.tokensTitle')}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {tokens.map((token) => {
                            const inUse = usedTokens.includes(token.key);
                            const reliable = token.alwaysAvailable;
                            return (
                              <button
                                key={token.key}
                                type="button"
                                onClick={() =>
                                  setDraftBody((value) => `${value}{{${token.key}}}`)
                                }
                                title={t(token.hintKey)}
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                                  inUse
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : reliable
                                      ? 'border-amateur-border bg-amateur-canvas text-amateur-ink hover:border-emerald-200 hover:bg-emerald-50'
                                      : 'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-50'
                                }`}
                              >
                                {`{{${token.key}}}`}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1 text-[11px] text-amateur-muted">
                          {t('pages.communications.draftPanel.tokensHint')}
                        </p>
                      </div>
                    ) : null}
                    <div className="mt-4 space-y-3">
                      <label className="flex flex-col gap-1 text-sm">
                        <span>{t('pages.communications.draftPanel.topicLabel')}</span>
                        <input
                          value={draftTopic}
                          onChange={(e) => setDraftTopic(e.target.value)}
                          placeholder={t('pages.communications.draftPanel.topicPlaceholder')}
                          className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span>{t('pages.communications.draftPanel.messageLabel')}</span>
                        <textarea
                          value={draftBody}
                          onChange={(e) => setDraftBody(e.target.value)}
                          rows={8}
                          className="resize-y rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                        />
                        <span className="text-[11px] text-amateur-muted">
                          {t('pages.communications.draftPanel.tokenHint')}
                        </span>
                      </label>
                      {channel === 'email' ? (
                        <label className="flex flex-col gap-1 text-sm">
                          <span>{t('pages.communications.draftPanel.subjectLabel')}</span>
                          <input
                            value={draftSubject}
                            onChange={(e) => setDraftSubject(e.target.value)}
                            placeholder={t('pages.communications.draftPanel.subjectPlaceholder')}
                            className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                          />
                        </label>
                      ) : null}
                      <label className="flex flex-col gap-1 text-sm">
                        <span>{t('pages.communications.draftPanel.noteLabel')}</span>
                        <input
                          value={draftNote}
                          onChange={(e) => setDraftNote(e.target.value)}
                          placeholder={t('pages.communications.draftPanel.notePlaceholder')}
                          className="rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2"
                        />
                      </label>
                    </div>
                    {channel === 'whatsapp' ? (
                      <DeliveryModeBanner
                        readiness={readiness}
                        loading={readinessLoading}
                        preferredMode={preferredMode}
                      />
                    ) : null}
                    {deliveryNotice ? (
                      <InlineAlert
                        tone={
                          deliveryAttemptState === 'sent'
                            ? deliveryCounts && deliveryCounts.failed > 0
                              ? 'warning'
                              : 'info'
                            : deliveryAttemptState === 'failed'
                              ? 'error'
                              : 'warning'
                        }
                        className="mt-3"
                      >
                        {deliveryNotice}
                      </InlineAlert>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {channel === 'whatsapp' && preferredMode === 'direct' ? (
                        <Button
                          type="button"
                          onClick={() => void handleSendDirect()}
                          disabled={
                            sendingDirect ||
                            audience.items.length === 0 ||
                            reachableRecipients.length === 0
                          }
                        >
                          {sendingDirect
                            ? t('pages.communications.delivery.actions.sending')
                            : t('pages.communications.delivery.actions.sendDirect')}
                        </Button>
                      ) : null}
                      {channel === 'whatsapp' && reachableRecipients[0]?.link ? (
                        <a
                          href={reachableRecipients[0].link}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                          {preferredMode === 'direct'
                            ? t('pages.communications.delivery.actions.openWhatsAppInstead')
                            : t('pages.communications.actions.openWhatsAppFirst')}
                        </a>
                      ) : null}
                      {channel === 'whatsapp' ? (
                        <a
                          href={buildWhatsAppShareLink(previewWithoutRecipient(draftBody)) ?? '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                        >
                          {t('pages.communications.actions.shareWhatsApp')}
                        </a>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          void navigator.clipboard.writeText(perFamilyMessages || draftBody);
                          setSavedNotice(t('pages.communications.actions.copyMessages'));
                        }}
                      >
                        {t('pages.communications.actions.copyMessages')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          void navigator.clipboard.writeText(contactLines.join('\n'));
                          setSavedNotice(t('pages.communications.actions.copyContacts'));
                        }}
                        disabled={contactLines.length === 0}
                      >
                        {t('pages.communications.actions.copyContacts')}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void handleSaveDraft()}
                        disabled={savingOutreach || audience.items.length === 0}
                      >
                        {savingOutreach
                          ? t('pages.communications.actions.saving')
                          : activeDraftId
                            ? t('pages.communications.actions.updateDraft')
                            : t('pages.communications.actions.saveDraft')}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void handleLogOutreach()}
                        disabled={savingOutreach || audience.items.length === 0}
                      >
                        {savingOutreach
                          ? t('pages.communications.actions.saving')
                          : t('pages.communications.actions.logFollowUp')}
                      </Button>
                      {activeDraftId ? (
                        <>
                          <Button type="button" variant="ghost" onClick={handleStartNewDraft}>
                            {t('pages.communications.actions.startNewDraft')}
                          </Button>
                          {activeDraftStatus !== 'archived' ? (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => void handleArchiveDraft()}
                            >
                              {t('pages.communications.actions.archive')}
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                    {aggregatedMissingTokens.length > 0 ? (
                      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {t('pages.communications.draftPanel.missingTokensWarning', {
                          tokens: aggregatedMissingTokens.map((tk) => `{{${tk}}}`).join(', '),
                        })}
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>
            </div>
          )}
        </ListPageFrame>
      )}
    </div>
  );
}

function FiltersPanel(props: {
  athleteStatus: AthleteStatus | '';
  coachId: string;
  coaches: Coach[];
  familyReadiness: FamilyReadinessStatus | '';
  financialState: string;
  groupId: string;
  groups: ClubGroup[];
  needsFollowUp: boolean;
  portalEnabledOnly: boolean;
  portalPendingOnly: boolean;
  primaryContactsOnly: boolean;
  privateLessonStatus: string;
  sessions: TrainingSession[];
  setAthleteStatus: (value: AthleteStatus | '') => void;
  setCoachId: (value: string) => void;
  setFamilyReadiness: (value: FamilyReadinessStatus | '') => void;
  setFinancialState: (value: string) => void;
  setGroupId: (value: string) => void;
  setNeedsFollowUp: (value: boolean) => void;
  setPortalEnabledOnly: (value: boolean) => void;
  setPortalPendingOnly: (value: boolean) => void;
  setPrimaryContactsOnly: (value: boolean) => void;
  setPrivateLessonStatus: (value: string) => void;
  setTeamId: (value: string) => void;
  setTrainingSessionId: (value: string) => void;
  teamId: string;
  trainingSessionId: string;
  visibleTeams: Team[];
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-4 grid gap-3 rounded-2xl border border-amateur-border bg-amateur-canvas p-4 md:grid-cols-2 xl:grid-cols-3">
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <span>{t('pages.athletes.primaryGroup')}</span>
        <select
          value={props.groupId}
          onChange={(e) => props.setGroupId(e.target.value)}
          className="bg-transparent text-amateur-ink outline-none"
        >
          <option value="">{t('pages.communications.allGroups')}</option>
          {props.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <span>{t('pages.teams.title')}</span>
        <select
          value={props.teamId}
          onChange={(e) => props.setTeamId(e.target.value)}
          className="bg-transparent text-amateur-ink outline-none"
        >
          <option value="">{t('pages.communications.allTeams')}</option>
          {props.visibleTeams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <span>{t('pages.coaches.title')}</span>
        <select
          value={props.coachId}
          onChange={(e) => props.setCoachId(e.target.value)}
          className="bg-transparent text-amateur-ink outline-none"
        >
          <option value="">{t('pages.communications.allCoaches')}</option>
          {props.coaches.map((coach) => (
            <option key={coach.id} value={coach.id}>
              {getPersonName(coach)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <span>{t('pages.athletes.status')}</span>
        <select
          value={props.athleteStatus}
          onChange={(e) => props.setAthleteStatus((e.target.value as AthleteStatus) || '')}
          className="bg-transparent text-amateur-ink outline-none"
        >
          <option value="">{t('pages.communications.anyAthleteStatus')}</option>
          {(['trial', 'active', 'paused', 'inactive', 'archived'] as AthleteStatus[]).map((value) => (
            <option key={value} value={value}>
              {getAthleteStatusLabel(t, value)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <span>{t('pages.communications.financialState')}</span>
        <select
          value={props.financialState}
          onChange={(e) => props.setFinancialState(e.target.value)}
          className="bg-transparent text-amateur-ink outline-none"
        >
          <option value="">{t('pages.communications.anyFinancialState')}</option>
          <option value="outstanding">{t('pages.communications.financialOutstanding')}</option>
          <option value="overdue">{t('pages.communications.financialOverdue')}</option>
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <span>{t('pages.communications.privateLessonStatus')}</span>
        <select
          value={props.privateLessonStatus}
          onChange={(e) => props.setPrivateLessonStatus(e.target.value)}
          className="bg-transparent text-amateur-ink outline-none"
        >
          <option value="">{t('pages.communications.anyLessonStatus')}</option>
          <option value="planned">{t('app.enums.trainingStatus.planned')}</option>
          <option value="completed">{t('app.enums.trainingStatus.completed')}</option>
          <option value="cancelled">{t('app.enums.trainingStatus.cancelled')}</option>
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <span>{t('pages.training.detailTitle')}</span>
        <select
          value={props.trainingSessionId}
          onChange={(e) => props.setTrainingSessionId(e.target.value)}
          className="bg-transparent text-amateur-ink outline-none"
        >
          <option value="">{t('pages.communications.anySession')}</option>
          {props.sessions.slice(0, 50).map((session) => (
            <option key={session.id} value={session.id}>
              {session.title}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <span>{t('pages.communications.familyReadiness')}</span>
        <select
          value={props.familyReadiness}
          onChange={(e) =>
            props.setFamilyReadiness((e.target.value as FamilyReadinessStatus) || '')
          }
          className="bg-transparent text-amateur-ink outline-none"
        >
          <option value="">{t('pages.communications.anyFamilyReadiness')}</option>
          {(['incomplete', 'awaiting_guardian_action', 'awaiting_staff_review', 'complete'] as FamilyReadinessStatus[]).map(
            (value) => (
              <option key={value} value={value}>
                {getFamilyReadinessStatusLabel(t, value)}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <input
          type="checkbox"
          checked={props.primaryContactsOnly}
          onChange={(e) => props.setPrimaryContactsOnly(e.target.checked)}
        />
        <span>{t('pages.communications.primaryContactsOnly')}</span>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <input
          type="checkbox"
          checked={props.needsFollowUp}
          onChange={(e) => props.setNeedsFollowUp(e.target.checked)}
        />
        <span>{t('pages.communications.needsFollowUpOnly')}</span>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <input
          type="checkbox"
          checked={props.portalEnabledOnly}
          onChange={(e) => props.setPortalEnabledOnly(e.target.checked)}
        />
        <span>{t('pages.communications.portalEnabledOnly')}</span>
      </label>
      <label className="flex items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2 text-sm text-amateur-muted">
        <input
          type="checkbox"
          checked={props.portalPendingOnly}
          onChange={(e) => props.setPortalPendingOnly(e.target.checked)}
        />
        <span>{t('pages.communications.portalPendingOnly')}</span>
      </label>
    </div>
  );
}

function RecipientCard({
  channel,
  link,
  member,
  message,
  missingTokens,
  subject,
}: {
  channel: CommunicationChannel;
  link: string | null;
  member: CommunicationAudienceMember;
  message: string;
  missingTokens: string[];
  subject: string;
}) {
  const { t } = useTranslation();
  const reachState = classifyMemberReach(member, channel);
  const wantedChannel = channel === 'email' ? 'email' : 'phone';
  const reachToneClass =
    reachState === 'whatsapp' || reachState === 'phone'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : reachState === 'email'
        ? 'border-violet-200 bg-violet-50 text-violet-700'
        : 'border-rose-200 bg-rose-50 text-rose-700';
  const reachLabel =
    reachState === 'unreachable' && member.guardians.length === 0
      ? t('pages.communications.recipientList.reach.no_guardian')
      : reachState === 'unreachable'
        ? wantedChannel === 'email'
          ? t('pages.communications.recipientList.reach.no_email')
          : t('pages.communications.recipientList.reach.no_phone')
        : reachState === 'email' && wantedChannel === 'phone'
          ? t('pages.communications.recipientList.reach.email')
          : t(`pages.communications.recipientList.reach.${reachState}`);
  return (
    <article className="rounded-2xl border border-amateur-border bg-amateur-surface px-4 py-3 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-amateur-ink">{member.athleteName}</p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${reachToneClass}`}
            >
              {reachLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-amateur-muted">
            {[
              getAthleteStatusLabel(t, member.athleteStatus),
              member.groupName,
              ...member.teamNames,
            ]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {member.reasons.slice(0, 2).map((reason) => (
              <span
                key={reason}
                className="rounded-full bg-amateur-canvas px-2 py-0.5 text-[11px] text-amateur-muted"
              >
                {getPrivateLessonReasonLabel(t, reason)}
              </span>
            ))}
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                getFamilyReadinessTone(member.familyReadinessStatus) === 'danger'
                  ? 'bg-amber-100 text-amber-700'
                  : getFamilyReadinessTone(member.familyReadinessStatus) === 'success'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-700'
              }`}
            >
              {getFamilyReadinessStatusLabel(t, member.familyReadinessStatus)}
            </span>
          </div>
          {missingTokens.length > 0 ? (
            <p className="mt-2 text-[11px] text-amber-800">
              {t('pages.communications.recipientList.missingTokens', {
                tokens: missingTokens.map((token) => `{{${token}}}`).join(', '),
              })}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex min-h-[40px] items-center rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                channel === 'whatsapp'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : channel === 'phone'
                    ? 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                    : channel === 'email'
                      ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                      : 'border-amateur-border bg-amateur-canvas text-amateur-ink'
              }`}
            >
              {channel === 'whatsapp'
                ? t('pages.communications.actions.openWhatsAppOne')
                : channel === 'phone'
                  ? t('pages.communications.actions.callRecipient')
                  : channel === 'email'
                    ? t('pages.communications.actions.openEmail')
                    : t('pages.communications.actions.openLink')}
            </a>
          ) : (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700">
              {channel === 'email'
                ? t('pages.communications.recipientList.noEmail')
                : t('pages.communications.recipientList.noPhone')}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(message);
            }}
          >
            {t('pages.communications.actions.copyMessage')}
          </Button>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {member.guardians.length === 0 ? (
          <p className="text-sm text-amateur-muted">{t('pages.communications.noGuardians')}</p>
        ) : (
          member.guardians.map((guardian) => {
            const reachable = isReachableForChannel(guardian, channel);
            const guardianLink =
              channel === 'whatsapp'
                ? buildWhatsAppLink(guardian.phone, message)
                : channel === 'phone'
                  ? buildPhoneLink(guardian.phone)
                  : channel === 'email'
                    ? buildMailtoLink(guardian.email, subject, message)
                    : null;
            return (
              <div
                key={guardian.guardianId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amateur-border/70 bg-amateur-canvas px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-amateur-ink">
                    {guardian.name}
                    {guardian.isPrimaryContact ? ` · ${t('pages.communications.recipientList.primary')}` : ''}
                  </p>
                  <p className="text-xs text-amateur-muted">
                    {[guardian.relationshipType, guardian.phone, guardian.email].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {guardianLink ? (
                  <a
                    href={guardianLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-amateur-accent hover:underline"
                  >
                    {channel === 'whatsapp'
                      ? t('pages.communications.actions.openWhatsAppOne')
                      : channel === 'phone'
                        ? t('pages.communications.actions.callRecipient')
                        : channel === 'email'
                          ? t('pages.communications.actions.openEmail')
                          : t('pages.communications.actions.openLink')}
                  </a>
                ) : reachable ? null : (
                  <span className="text-[11px] text-amber-700">
                    {channel === 'email'
                      ? t('pages.communications.recipientList.noEmail')
                      : t('pages.communications.recipientList.noPhone')}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}

function DeliveryModeBanner({
  readiness,
  loading,
  preferredMode,
}: {
  readiness: CommunicationReadinessResponse | null;
  loading: boolean;
  preferredMode: DeliveryMode;
}) {
  const { t } = useTranslation();
  const stateKey = readiness?.whatsapp.state ?? 'not_configured';
  const stateLabel = t(`pages.communications.delivery.readiness.states.${stateKey}`, {
    defaultValue: stateKey,
  });
  const modeLabel = loading
    ? t('pages.communications.delivery.modeBadge.loading')
    : t(`pages.communications.delivery.modeBadge.${preferredMode}`);
  const modeHint = loading
    ? t('pages.communications.delivery.modeHint.loading')
    : preferredMode === 'direct'
      ? t('pages.communications.delivery.modeHint.direct')
      : readiness?.whatsapp.cloudApiEnabled && readiness.whatsapp.state !== 'direct_capable'
        ? t('pages.communications.delivery.modeHint.fallback')
        : t('pages.communications.delivery.modeHint.assisted');
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-2">
      <span
        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${DELIVERY_MODE_TONE[preferredMode]}`}
      >
        {modeLabel}
      </span>
      <span className="rounded-full border border-amateur-border bg-amateur-canvas px-2 py-0.5 text-[11px] font-medium text-amateur-muted">
        {stateLabel}
      </span>
      <p className="text-xs text-amateur-muted">{modeHint}</p>
    </div>
  );
}

function FollowUpHistory({
  history,
  filteredItems,
  templates,
  languageTag,
  statusFilter,
  onChangeStatusFilter,
  templateFilter,
  onChangeTemplateFilter,
  channelFilter,
  onChangeChannelFilter,
  sourceFilter,
  onChangeSourceFilter,
  templateOptions,
  channelOptions,
  sourceOptions,
  staleAfterDays,
  staleDraftCount,
  onReopen,
}: {
  history: OutreachActivityListResponse | null;
  filteredItems: OutreachActivity[];
  templates: CommunicationTemplate[];
  languageTag: string;
  statusFilter: 'all' | OutreachStatus;
  onChangeStatusFilter: (status: 'all' | OutreachStatus) => void;
  templateFilter: string;
  onChangeTemplateFilter: (value: string) => void;
  channelFilter: string;
  onChangeChannelFilter: (value: string) => void;
  sourceFilter: string;
  onChangeSourceFilter: (value: string) => void;
  templateOptions: string[];
  channelOptions: string[];
  sourceOptions: string[];
  staleAfterDays: number;
  staleDraftCount: number;
  onReopen: (activity: OutreachActivity) => void;
}) {
  const { t } = useTranslation();
  if (!history) {
    return <p className="text-sm text-amateur-muted">{t('app.states.loading')}</p>;
  }
  const counts = history.counts;
  const filterButtons: Array<{ value: 'all' | OutreachStatus; count?: number }> = [
    { value: 'all', count: (counts.draft ?? 0) + (counts.logged ?? 0) },
    { value: 'draft', count: counts.draft ?? 0 },
    { value: 'logged', count: counts.logged ?? 0 },
    { value: 'archived', count: counts.archived ?? 0 },
  ];
  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t('pages.communications.lifecycle.draft')} value={counts.draft ?? 0} compact />
        <StatCard label={t('pages.communications.lifecycle.logged')} value={counts.logged ?? 0} compact />
        <StatCard label={t('pages.communications.channels.whatsapp')} value={counts.whatsapp} compact />
        <StatCard label={t('pages.communications.channels.email')} value={counts.email} compact />
      </section>
      {staleDraftCount > 0 ? (
        <InlineAlert tone="info">
          {t('pages.communications.history.staleDraftsSummary', {
            count: staleDraftCount,
            days: staleAfterDays,
          })}
        </InlineAlert>
      ) : null}
      <section className="rounded-2xl border border-amateur-border bg-amateur-canvas p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-amateur-ink">
              {t('pages.communications.history.title')}
            </h2>
            <p className="mt-1 text-sm text-amateur-muted">{t('pages.communications.history.hint')}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filterButtons.map((button) => {
              const active = statusFilter === button.value;
              return (
                <button
                  key={button.value}
                  type="button"
                  onClick={() => onChangeStatusFilter(button.value)}
                  className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? 'border-amateur-accent bg-amateur-accent-soft text-amateur-accent'
                      : 'border-amateur-border bg-amateur-surface text-amateur-muted hover:text-amateur-ink'
                  }`}
                  aria-pressed={active}
                >
                  {t(`pages.communications.history.filter.${button.value}`)}
                  {typeof button.count === 'number' ? ` · ${button.count}` : ''}
                </button>
              );
            })}
          </div>
        </div>
        {(templateOptions.length > 0 ||
          channelOptions.length > 0 ||
          sourceOptions.length > 0) ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {templateOptions.length > 0 ? (
              <label className="flex items-center gap-1.5 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-1.5 text-xs text-amateur-muted">
                <span className="font-medium uppercase tracking-wide">
                  {t('pages.communications.history.filterTemplate')}
                </span>
                <select
                  value={templateFilter}
                  onChange={(e) => onChangeTemplateFilter(e.target.value)}
                  className="bg-transparent text-amateur-ink outline-none"
                >
                  <option value="">{t('pages.communications.history.filterTemplateAll')}</option>
                  {templateOptions.map((key) => {
                    const tpl = templates.find((entry) => entry.key === key);
                    return (
                      <option key={key} value={key}>
                        {tpl ? t(tpl.titleKey) : key}
                      </option>
                    );
                  })}
                </select>
              </label>
            ) : null}
            {channelOptions.length > 0 ? (
              <label className="flex items-center gap-1.5 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-1.5 text-xs text-amateur-muted">
                <span className="font-medium uppercase tracking-wide">
                  {t('pages.communications.history.filterChannel')}
                </span>
                <select
                  value={channelFilter}
                  onChange={(e) => onChangeChannelFilter(e.target.value)}
                  className="bg-transparent text-amateur-ink outline-none"
                >
                  <option value="">{t('pages.communications.history.filterChannelAll')}</option>
                  {channelOptions.map((value) => (
                    <option key={value} value={value}>
                      {getCommunicationChannelLabel(t, value)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {sourceOptions.length > 0 ? (
              <label className="flex items-center gap-1.5 rounded-xl border border-amateur-border bg-amateur-surface px-3 py-1.5 text-xs text-amateur-muted">
                <span className="font-medium uppercase tracking-wide">
                  {t('pages.communications.history.filterSource')}
                </span>
                <select
                  value={sourceFilter}
                  onChange={(e) => onChangeSourceFilter(e.target.value)}
                  className="bg-transparent text-amateur-ink outline-none"
                >
                  <option value="">{t('pages.communications.history.filterSourceAll')}</option>
                  {sourceOptions.map((value) => (
                    <option key={value} value={value}>
                      {getCommunicationSourceLabel(t, value)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ) : null}
        {filteredItems.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title={t('pages.communications.history.title')}
              hint={
                history.items.length === 0
                  ? t('pages.communications.history.empty')
                  : t('pages.communications.history.emptyFiltered')
              }
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {filteredItems.map((activity) => (
              <FollowUpHistoryRow
                key={activity.id}
                activity={activity}
                templates={templates}
                languageTag={languageTag}
                staleAfterDays={staleAfterDays}
                onReopen={onReopen}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FollowUpHistoryRow({
  activity,
  templates,
  languageTag,
  staleAfterDays,
  onReopen,
}: {
  activity: OutreachActivity;
  templates: CommunicationTemplate[];
  languageTag: string;
  staleAfterDays: number;
  onReopen: (activity: OutreachActivity) => void;
}) {
  const { t } = useTranslation();
  const sourceLabel = getCommunicationSourceLabel(t, activity.sourceSurface, activity.sourceKey);
  const channelLabel = getCommunicationChannelLabel(t, activity.channel);
  const template = templates.find((item) => item.key === activity.templateKey) ?? null;
  const audienceSummary = (activity.audienceSnapshot?.audienceSummary ?? null) as
    | { contextLabel?: string }
    | null;
  const status = (activity.status ?? 'logged') as OutreachStatus;
  const isStale = isOutreachStale(activity, staleAfterDays);
  const ageLabel = describeActivityAge(t, activity);
  const deliveryState = (activity.delivery?.state ?? 'prepared') as DeliveryState;
  const attemptCounts = activity.delivery?.attemptCounts ?? null;
  const isPartial =
    deliveryState === 'sent' && attemptCounts ? attemptCounts.failed > 0 : false;
  const deliveryLabel = isPartial
    ? t('pages.communications.delivery.history.partial', {
        sent: attemptCounts?.sent ?? 0,
        total: attemptCounts?.attempted ?? 0,
        defaultValue: t('pages.communications.delivery.history.sent'),
      })
    : t(`pages.communications.delivery.history.${deliveryState}`, {
        defaultValue: t('pages.communications.delivery.history.prepared'),
      });
  return (
    <li className="rounded-2xl border border-amateur-border bg-amateur-surface px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[status]}`}
            >
              {t(`pages.communications.lifecycle.${status}`)}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CHANNEL_TONE[activity.channel as CommunicationChannel] ?? CHANNEL_TONE.manual}`}
            >
              {channelLabel}
            </span>
            <span className="rounded-full bg-amateur-canvas px-2 py-0.5 text-[11px] text-amateur-muted">
              {sourceLabel}
            </span>
            {template ? (
              <span className="rounded-full bg-amateur-canvas px-2 py-0.5 text-[11px] text-amateur-muted">
                {t(template.titleKey)}
              </span>
            ) : null}
            {isStale ? (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                {t('pages.communications.lifecycle.stillRelevant')}
              </span>
            ) : null}
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                isPartial
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : DELIVERY_STATE_TONE[deliveryState]
              }`}
              title={activity.delivery?.detail ?? undefined}
            >
              {deliveryLabel}
            </span>
          </div>
          <p className="mt-2 font-medium text-amateur-ink">{activity.topic}</p>
          <p className="mt-1 text-xs text-amateur-muted">
            {ageLabel} · {formatDateTime(activity.createdAt, languageTag)} ·{' '}
            {activity.createdByName
              ? t('pages.communications.history.savedBy', { name: activity.createdByName })
              : t('pages.communications.history.savedAnonymous')}
          </p>
        </div>
        <div className="text-right text-xs text-amateur-muted">
          <p>{t('pages.communications.history.recipientsCount', { count: activity.recipientCount })}</p>
          <p>
            {t('pages.communications.history.reachableCount', {
              count: activity.reachableGuardianCount,
            })}
          </p>
          {audienceSummary?.contextLabel ? (
            <p className="mt-1 italic">{audienceSummary.contextLabel}</p>
          ) : null}
        </div>
      </div>
      {activity.messagePreview ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-semibold text-amateur-accent">
            {t('pages.communications.history.messagePreviewLabel')}
          </summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-amateur-canvas px-3 py-2 text-xs text-amateur-ink">
            {activity.messagePreview}
          </pre>
        </details>
      ) : null}
      {activity.note ? (
        <p className="mt-2 rounded-lg bg-amateur-canvas px-3 py-2 text-xs text-amateur-muted">
          {activity.note}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onReopen(activity)}
        >
          {status === 'draft'
            ? t('pages.communications.history.continueDraft')
            : t('pages.communications.history.reuseContext')}
        </Button>
        {activity.sourceSurface !== 'manual' ? (
          <Link to={buildSourceLink(activity)} className="text-amateur-accent hover:underline">
            {t('pages.communications.history.openOriginalSource')} →
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function buildSourceLink(activity: OutreachActivity): string {
  const params = new URLSearchParams();
  const snapshot = (activity.audienceSnapshot ?? {}) as {
    audienceFilters?: Record<string, unknown>;
  };
  const filters = snapshot.audienceFilters ?? null;

  if (filters && typeof filters === 'object') {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === 'string' && item) {
            params.append(key, item);
          }
        });
        continue;
      }

      if (typeof value === 'boolean') {
        if (value) {
          params.set(key, 'true');
        }
        continue;
      }

      if (typeof value === 'string' && value) {
        params.set(key, value);
      }
    }
  }
  params.set('source', activity.sourceSurface);
  if (activity.sourceKey) params.set('sourceKey', activity.sourceKey);
  if (activity.templateKey) params.set('template', activity.templateKey);
  if (activity.channel) params.set('channel', activity.channel);
  return `/app/communications?${params.toString()}`;
}
