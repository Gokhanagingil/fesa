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
