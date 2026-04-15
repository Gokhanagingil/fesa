import type { TFunction } from 'i18next';
import type {
  ActionCenterItem,
  ActionCenterItemCategory,
  ActionCenterItemMutation,
  ActionCenterItemType,
  ActionCenterItemUrgency,
  Athlete,
  AthleteCharge,
  AthleteChargeStatus,
  FamilyActionRequest,
  FamilyActionRequestStatus,
  FamilyActionRequestType,
  FamilyReadinessStatus,
  AthleteGuardianLink,
  AthleteStatus,
  AttendanceStatus,
  Coach,
  Guardian,
  GuardianPortalAccessStatus,
  PrivateLesson,
  TrainingSessionStatus,
} from './domain-types';

type NameLike = Pick<Athlete, 'firstName' | 'lastName' | 'preferredName'> | Guardian;

export function getPersonName(person: NameLike): string {
  const preferredName = 'preferredName' in person ? person.preferredName?.trim() : null;
  return preferredName || `${person.firstName} ${person.lastName}`;
}

export function getCoachName(coach: Coach | null | undefined): string {
  if (!coach) return '—';
  return coach.preferredName?.trim() || `${coach.firstName} ${coach.lastName}`;
}

export function formatDate(value: string | null | undefined, language: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined, language: string): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function getAthleteStatusLabel(t: TFunction, status: AthleteStatus): string {
  return t(`app.enums.athleteStatus.${status}`);
}

export function getEnrollmentReadinessTone(missingCount: number): 'default' | 'danger' {
  return missingCount > 0 ? 'danger' : 'default';
}

export function getFamilyReadinessLabel(t: TFunction, status: FamilyReadinessStatus): string {
  return t(`app.enums.familyReadinessStatus.${status}`);
}

export function getFamilyReadinessStatusLabel(t: TFunction, status: FamilyReadinessStatus): string {
  return getFamilyReadinessLabel(t, status);
}

export function getFamilyReadinessTone(
  status: FamilyReadinessStatus,
): 'default' | 'danger' | 'warning' | 'success' {
  switch (status) {
    case 'incomplete':
      return 'danger';
    case 'awaiting_guardian_action':
    case 'awaiting_staff_review':
      return 'warning';
    case 'complete':
    default:
      return 'success';
  }
}

export function getFamilyActionRequestTypeLabel(t: TFunction, type: FamilyActionRequestType): string {
  return t(`app.enums.familyActionRequestType.${type}`);
}

export function getFamilyActionTypeLabel(t: TFunction, type: FamilyActionRequestType): string {
  return getFamilyActionRequestTypeLabel(t, type);
}

export function getFamilyActionRequestStatusLabel(t: TFunction, status: FamilyActionRequestStatus): string {
  return t(`app.enums.familyActionRequestStatus.${status}`);
}

export function getFamilyActionStatusLabel(t: TFunction, status: FamilyActionRequestStatus): string {
  return getFamilyActionRequestStatusLabel(t, status);
}

export function getFamilyActionActorLabel(t: TFunction, actor: FamilyActionRequest['events'][number]['actor']): string {
  return t(`app.enums.familyActionActor.${actor}`);
}

export function getTrainingStatusLabel(t: TFunction, status: TrainingSessionStatus): string {
  return t(`app.enums.trainingStatus.${status}`);
}

export function getLessonStatusLabel(t: TFunction, status: TrainingSessionStatus): string {
  return getTrainingStatusLabel(t, status);
}

export function getPrivateLessonReasonLabel(t: TFunction, reason: string): string {
  if (reason.startsWith('group:')) {
    return t('pages.communications.reasonGroup', { name: reason.slice('group:'.length) });
  }
  if (reason.startsWith('team:')) {
    return t('pages.communications.reasonTeam', { name: reason.slice('team:'.length) });
  }
  if (reason.startsWith('private_lesson:')) {
    return t('pages.communications.reasonPrivateLesson', {
      status: getTrainingStatusLabel(t, reason.slice('private_lesson:'.length) as TrainingSessionStatus),
    });
  }
  if (reason.startsWith('family_readiness:')) {
    return t('pages.communications.reasonFamilyReadiness', {
      status: getFamilyReadinessLabel(t, reason.slice('family_readiness:'.length) as FamilyReadinessStatus),
    });
  }
  const labels: Record<string, string> = {
    'finance:overdue': t('pages.communications.reasonOverdue'),
    'finance:outstanding': t('pages.communications.reasonOutstanding'),
    training_session: t('pages.communications.reasonTraining'),
    coach_assignment: t('pages.communications.reasonCoach'),
    'family_action:pending': t('pages.communications.reasonPendingFamily'),
    'family_action:review': t('pages.communications.reasonAwaitingReview'),
    manual_selection: t('pages.communications.reasonManual'),
  };
  return labels[reason] ?? reason;
}

export function getPrivateLessonAttendanceLabel(t: TFunction, status: PrivateLesson['attendanceStatus']): string {
  if (!status) return t('pages.privateLessons.noAttendance');
  return getAttendanceStatusLabel(t, status);
}

export function getAttendanceStatusLabel(t: TFunction, status: AttendanceStatus): string {
  return t(`app.enums.attendanceStatus.${status}`);
}

export function getChargeStatusLabel(t: TFunction, status: AthleteChargeStatus): string {
  return t(`app.enums.athleteChargeStatus.${status}`);
}

export function getGuardianRelationshipLabel(t: TFunction, relationshipType: string): string {
  return t(`app.enums.guardianRelationship.${relationshipType}`, { defaultValue: relationshipType });
}

export function getGuardianRelationshipSummary(t: TFunction, link: AthleteGuardianLink): string {
  const parts = [getGuardianRelationshipLabel(t, link.relationshipType)];
  if (link.isPrimaryContact) {
    parts.push(t('pages.athletes.primaryContact'));
  }
  return parts.join(' · ');
}

export function getGuardianPortalAccessStatusLabel(t: TFunction, status: GuardianPortalAccessStatus): string {
  return t(`app.enums.guardianPortalAccessStatus.${status}`);
}

export function getGuardianPortalAccessTone(
  status: GuardianPortalAccessStatus,
): 'warning' | 'success' | 'default' {
  switch (status) {
    case 'active':
      return 'success';
    case 'invited':
      return 'warning';
    case 'disabled':
    default:
      return 'default';
  }
}

export function getChargeCurrencyAmount(charge: AthleteCharge): string {
  return `${charge.chargeItem?.currency ? `${charge.chargeItem.currency} ` : ''}${charge.amount}`;
}

export function getMoneyAmount(value: string | number, currency?: string | null): string {
  const amount = typeof value === 'number' ? value.toFixed(2) : value;
  return `${currency ? `${currency} ` : ''}${amount}`;
}

export function getChargeVisualStatus(charge: AthleteCharge): AthleteChargeStatus {
  return charge.derivedStatus ?? charge.status;
}

export function formatEnumLabel(t: TFunction, key: string, fallback: string): string {
  return t(key, { defaultValue: fallback });
}

export function getActionCenterCategoryLabel(t: TFunction, category: ActionCenterItemCategory): string {
  return t(`pages.actionCenter.categories.${category}`);
}

export function getActionCenterTypeLabel(t: TFunction, type: ActionCenterItemType): string {
  return t(`pages.actionCenter.types.${type}`);
}

export function getActionCenterUrgencyLabel(t: TFunction, urgency: ActionCenterItemUrgency): string {
  return t(`pages.actionCenter.urgency.${urgency}`);
}

export function getActionCenterUrgencyTone(
  urgency: ActionCenterItemUrgency,
): 'danger' | 'warning' | 'default' | 'success' {
  switch (urgency) {
    case 'overdue':
      return 'danger';
    case 'today':
      return 'warning';
    case 'upcoming':
      return 'default';
    case 'normal':
    default:
      return 'success';
  }
}

export function getActionCenterItemSummary(t: TFunction, item: ActionCenterItem): string {
  const count = Number(item.context.issueCount ?? item.count ?? 0);
  const amount = typeof item.amount === 'string' && item.amount ? getMoneyAmount(item.amount, item.currency) : null;

  switch (item.type) {
    case 'finance_follow_up':
      return t('pages.actionCenter.summaries.finance', {
        count,
        amount: amount ?? getMoneyAmount('0.00', item.currency),
      });
    case 'family_review':
      return t('pages.actionCenter.summaries.familyReview', { count });
    case 'guardian_response':
      return t('pages.actionCenter.summaries.guardianResponse', { count });
    case 'readiness_gap':
      return t('pages.actionCenter.summaries.readiness', { count });
    case 'private_lesson_prep':
      return t('pages.actionCenter.summaries.privateLessonPrep', { count });
    case 'training_prep':
      return t('pages.actionCenter.summaries.trainingPrep', { count });
    case 'training_attendance':
      return t('pages.actionCenter.summaries.trainingAttendance');
    default:
      return getActionCenterTypeLabel(t, item.type);
  }
}

export function getActionCenterItemTitle(t: TFunction, item: ActionCenterItem): string {
  return t('pages.actionCenter.itemTitle', {
    type: getActionCenterTypeLabel(t, item.type),
    subject: item.subjectName,
  });
}

export function getActionCenterMutationLabel(t: TFunction, action: ActionCenterItemMutation): string {
  return t(`pages.actionCenter.actions.${action}`);
}
