import type { TFunction } from 'i18next';
import type {
  Athlete,
  AthleteCharge,
  AthleteChargeStatus,
  AthleteGuardianLink,
  AthleteStatus,
  AttendanceStatus,
  Guardian,
  TrainingSessionStatus,
} from './domain-types';

type NameLike = Pick<Athlete, 'firstName' | 'lastName' | 'preferredName'> | Guardian;

export function getPersonName(person: NameLike): string {
  const preferredName = 'preferredName' in person ? person.preferredName?.trim() : null;
  return preferredName || `${person.firstName} ${person.lastName}`;
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

export function getTrainingStatusLabel(t: TFunction, status: TrainingSessionStatus): string {
  return t(`app.enums.trainingStatus.${status}`);
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

export function getChargeCurrencyAmount(charge: AthleteCharge): string {
  return `${charge.chargeItem?.currency ? `${charge.chargeItem.currency} ` : ''}${charge.amount}`;
}

export function formatEnumLabel(t: TFunction, key: string, fallback: string): string {
  return t(key, { defaultValue: fallback });
}
