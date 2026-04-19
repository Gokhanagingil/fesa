/**
 * Communication & Follow-up — message templates (v1).
 *
 * The template library is intentionally small and operationally focused.
 * Templates carry warm, club-friendly defaults so staff can send a
 * meaningful follow-up in a couple of clicks.  The catalog is shipped
 * by the API but rendered/edited on the client; sending itself remains
 * assisted (eg. WhatsApp deep-link or copy-to-clipboard).
 */

export type CommunicationChannel = 'whatsapp' | 'phone' | 'email' | 'manual';

export type CommunicationTemplate = {
  key: string;
  /** Default channel suggested for this template. */
  defaultChannel: CommunicationChannel;
  /** Stable category for grouping in the UI. */
  category: 'finance' | 'attendance' | 'trial' | 'session' | 'group' | 'general';
  /** i18n key roots; the client renders both label and body via `t(...)`. */
  titleKey: string;
  bodyKey: string;
  /** Optional default subject for email-style channels. */
  subjectKey?: string;
  /** Audience hints shown in the UI. */
  hintKey?: string;
};

export const COMMUNICATION_TEMPLATES: CommunicationTemplate[] = [
  {
    key: 'overdue_payment_reminder',
    defaultChannel: 'whatsapp',
    category: 'finance',
    titleKey: 'pages.communications.templates.overduePayment.title',
    bodyKey: 'pages.communications.templates.overduePayment.body',
    subjectKey: 'pages.communications.templates.overduePayment.subject',
    hintKey: 'pages.communications.templates.overduePayment.hint',
  },
  {
    key: 'trial_warm_follow_up',
    defaultChannel: 'whatsapp',
    category: 'trial',
    titleKey: 'pages.communications.templates.trialFollowUp.title',
    bodyKey: 'pages.communications.templates.trialFollowUp.body',
    subjectKey: 'pages.communications.templates.trialFollowUp.subject',
    hintKey: 'pages.communications.templates.trialFollowUp.hint',
  },
  {
    key: 'attendance_check_in',
    defaultChannel: 'whatsapp',
    category: 'attendance',
    titleKey: 'pages.communications.templates.attendanceCheckIn.title',
    bodyKey: 'pages.communications.templates.attendanceCheckIn.body',
    subjectKey: 'pages.communications.templates.attendanceCheckIn.subject',
    hintKey: 'pages.communications.templates.attendanceCheckIn.hint',
  },
  {
    key: 'session_reminder',
    defaultChannel: 'whatsapp',
    category: 'session',
    titleKey: 'pages.communications.templates.sessionReminder.title',
    bodyKey: 'pages.communications.templates.sessionReminder.body',
    subjectKey: 'pages.communications.templates.sessionReminder.subject',
    hintKey: 'pages.communications.templates.sessionReminder.hint',
  },
  {
    key: 'group_announcement',
    defaultChannel: 'whatsapp',
    category: 'group',
    titleKey: 'pages.communications.templates.groupAnnouncement.title',
    bodyKey: 'pages.communications.templates.groupAnnouncement.body',
    subjectKey: 'pages.communications.templates.groupAnnouncement.subject',
    hintKey: 'pages.communications.templates.groupAnnouncement.hint',
  },
  {
    key: 'family_follow_up',
    defaultChannel: 'whatsapp',
    category: 'general',
    titleKey: 'pages.communications.templates.familyFollowUp.title',
    bodyKey: 'pages.communications.templates.familyFollowUp.body',
    subjectKey: 'pages.communications.templates.familyFollowUp.subject',
    hintKey: 'pages.communications.templates.familyFollowUp.hint',
  },
];

export function getTemplateByKey(key: string | null | undefined): CommunicationTemplate | null {
  if (!key) return null;
  return COMMUNICATION_TEMPLATES.find((template) => template.key === key) ?? null;
}

export const COMMUNICATION_CHANNELS: CommunicationChannel[] = ['whatsapp', 'phone', 'email', 'manual'];

/**
 * Catalog of personalization tokens that can appear in a draft message.
 * The catalog is shared with the client so the draft editor can show a
 * grounded list of supported tokens and explain which can be filled
 * reliably for the current audience.
 *
 * `name` is also accepted as an alias for `athleteName` to preserve the
 * v1 contract.
 */
export type CommunicationTemplateToken = {
  /** The bare token name (rendered as `{{name}}` in the message). */
  key: string;
  /** i18n key for the human label shown in the draft editor. */
  labelKey: string;
  /** i18n key for a short hint about what the token resolves to. */
  hintKey: string;
  /** Whether the token always resolves for any recipient or may be missing. */
  alwaysAvailable: boolean;
};

/**
 * Lightweight lifecycle / freshness policy.  We surface a gentle "still
 * relevant?" hint on saved drafts older than this many days.  The number
 * is intentionally small (a working week) so the hint feels like club
 * coordination rather than CRM nagging.
 */
export const COMMUNICATION_DRAFT_STALE_AFTER_DAYS = 5 as const;

export const COMMUNICATION_TEMPLATE_TOKENS: CommunicationTemplateToken[] = [
  {
    key: 'athleteName',
    labelKey: 'pages.communications.tokens.athleteName.label',
    hintKey: 'pages.communications.tokens.athleteName.hint',
    alwaysAvailable: true,
  },
  {
    key: 'guardianName',
    labelKey: 'pages.communications.tokens.guardianName.label',
    hintKey: 'pages.communications.tokens.guardianName.hint',
    alwaysAvailable: false,
  },
  {
    key: 'groupName',
    labelKey: 'pages.communications.tokens.groupName.label',
    hintKey: 'pages.communications.tokens.groupName.hint',
    alwaysAvailable: false,
  },
  {
    key: 'teamName',
    labelKey: 'pages.communications.tokens.teamName.label',
    hintKey: 'pages.communications.tokens.teamName.hint',
    alwaysAvailable: false,
  },
  {
    key: 'coachName',
    labelKey: 'pages.communications.tokens.coachName.label',
    hintKey: 'pages.communications.tokens.coachName.hint',
    alwaysAvailable: false,
  },
  {
    key: 'branchName',
    labelKey: 'pages.communications.tokens.branchName.label',
    hintKey: 'pages.communications.tokens.branchName.hint',
    alwaysAvailable: false,
  },
  {
    key: 'sessionLocation',
    labelKey: 'pages.communications.tokens.sessionLocation.label',
    hintKey: 'pages.communications.tokens.sessionLocation.hint',
    alwaysAvailable: false,
  },
  {
    key: 'nextSession',
    labelKey: 'pages.communications.tokens.nextSession.label',
    hintKey: 'pages.communications.tokens.nextSession.hint',
    alwaysAvailable: false,
  },
  {
    key: 'outstandingAmount',
    labelKey: 'pages.communications.tokens.outstandingAmount.label',
    hintKey: 'pages.communications.tokens.outstandingAmount.hint',
    alwaysAvailable: false,
  },
  {
    key: 'overdueAmount',
    labelKey: 'pages.communications.tokens.overdueAmount.label',
    hintKey: 'pages.communications.tokens.overdueAmount.hint',
    alwaysAvailable: false,
  },
  {
    key: 'clubName',
    labelKey: 'pages.communications.tokens.clubName.label',
    hintKey: 'pages.communications.tokens.clubName.hint',
    alwaysAvailable: false,
  },
];
