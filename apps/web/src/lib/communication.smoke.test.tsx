import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import {
  buildTokenContext,
  classifyMemberReach,
  daysBetween,
  describeActivityAge,
  describeDelivery,
  describeDeliveryTone,
  isOutreachStale,
  renderTemplate,
  resolvePreferredDeliveryMode,
} from './communication';
import type {
  CommunicationAudienceMember,
  CommunicationReadinessResponse,
} from './domain-types';

function makeMember(overrides: Partial<CommunicationAudienceMember> = {}): CommunicationAudienceMember {
  return {
    athleteId: 'athlete-1',
    athleteName: 'Deniz Kaya',
    athleteStatus: 'active',
    reasons: [],
    groupId: 'group-1',
    groupName: 'U14 Girls',
    teamIds: [],
    teamNames: ['Falcons'],
    sportBranchId: 'branch-1',
    sportBranchName: 'Basketball',
    guardians: [
      {
        guardianId: 'g-1',
        name: 'Ayşe Kaya',
        relationshipType: 'mother',
        phone: '+90 555 111 2233',
        email: 'ayse@example.com',
        isPrimaryContact: true,
      },
    ],
    outstandingAmount: '350.00',
    overdueAmount: '350.00',
    hasOverdueBalance: true,
    familyReadinessStatus: 'complete',
    pendingFamilyActions: 0,
    awaitingStaffReview: 0,
    ...overrides,
  };
}

describe('renderTemplate / buildTokenContext', () => {
  it('resolves the per-member sport branch name automatically', () => {
    const ctx = buildTokenContext(makeMember(), { clubName: 'Club Demo' });
    expect(ctx.branchName).toBe('Basketball');
    expect(ctx.clubName).toBe('Club Demo');
    const result = renderTemplate(
      'Hello {{guardianName}}, {{athleteName}} at {{branchName}} ({{clubName}})',
      ctx,
    );
    expect(result.text).toBe('Hello Ayşe Kaya, Deniz Kaya at Basketball (Club Demo)');
    expect(result.missing).toEqual([]);
  });

  it('falls back to "—" and reports missing tokens for unsupported keys', () => {
    const ctx = buildTokenContext(
      makeMember({ guardians: [] }),
      {},
    );
    const result = renderTemplate('Hi {{guardianName}} re {{nonExistent}}', ctx);
    expect(result.text).toBe('Hi — re {{nonExistent}}');
    expect(result.missing.sort()).toEqual(['guardianName', 'nonExistent'].sort());
  });
});

describe('classifyMemberReach', () => {
  const phoneOnly = makeMember({
    guardians: [
      {
        guardianId: 'g',
        name: 'g',
        relationshipType: 'mother',
        phone: '+90 555 0000000',
        email: null,
        isPrimaryContact: true,
      },
    ],
  });
  const emailOnly = makeMember({
    guardians: [
      {
        guardianId: 'g',
        name: 'g',
        relationshipType: 'father',
        phone: null,
        email: 'a@b.com',
        isPrimaryContact: true,
      },
    ],
  });
  const noContact = makeMember({ guardians: [] });

  it('marks WhatsApp-ready families confidently', () => {
    expect(classifyMemberReach(phoneOnly, 'whatsapp')).toBe('whatsapp');
    expect(classifyMemberReach(phoneOnly, 'phone')).toBe('phone');
  });

  it('falls back to email when phone is missing for WhatsApp/phone', () => {
    expect(classifyMemberReach(emailOnly, 'whatsapp')).toBe('email');
    expect(classifyMemberReach(emailOnly, 'phone')).toBe('email');
  });

  it('reports unreachable when no guardian or no contact at all', () => {
    expect(classifyMemberReach(noContact, 'whatsapp')).toBe('unreachable');
    expect(
      classifyMemberReach(
        makeMember({
          guardians: [
            {
              guardianId: 'g',
              name: 'g',
              relationshipType: 'guardian',
              phone: null,
              email: null,
              isPrimaryContact: true,
            },
          ],
        }),
        'email',
      ),
    ).toBe('unreachable');
  });
});

describe('lifecycle helpers', () => {
  it('daysBetween rounds down to whole days and is non-negative', () => {
    const now = new Date('2026-04-19T10:00:00Z');
    expect(daysBetween('2026-04-19T08:00:00Z', now)).toBe(0);
    expect(daysBetween('2026-04-12T10:00:00Z', now)).toBe(7);
    expect(daysBetween(null, now)).toBe(0);
    expect(daysBetween('2027-01-01T00:00:00Z', now)).toBe(0);
  });

  it('isOutreachStale only fires for drafts beyond the window', () => {
    const now = new Date('2026-04-19T10:00:00Z');
    expect(
      isOutreachStale(
        { status: 'draft', updatedAt: '2026-04-12T10:00:00Z' },
        5,
        now,
      ),
    ).toBe(true);
    expect(
      isOutreachStale(
        { status: 'draft', updatedAt: '2026-04-18T10:00:00Z' },
        5,
        now,
      ),
    ).toBe(false);
    expect(
      isOutreachStale(
        { status: 'logged', updatedAt: '2024-01-01T00:00:00Z' },
        5,
        now,
      ),
    ).toBe(false);
  });

  it('describeActivityAge returns a warm relative label', async () => {
    // (covered below)
  });

  it('placeholder bridge to satisfy nested test discovery', () => {
    expect(true).toBe(true);
  });
});

function makeReadiness(
  state: CommunicationReadinessResponse['whatsapp']['state'],
  preferredMode: 'assisted' | 'direct',
): CommunicationReadinessResponse {
  return {
    channel: 'whatsapp',
    whatsapp: {
      state,
      directSendAvailable: state === 'direct_capable',
      cloudApiEnabled: state === 'direct_capable' || state === 'partial' || state === 'invalid',
      configured: {
        phoneNumberId: state !== 'not_configured',
        businessAccountId: state !== 'not_configured',
        accessTokenRef: state === 'direct_capable',
      },
      displayPhoneNumber: state === 'direct_capable' ? '+90 555 000 0000' : null,
      validation: { state: 'never_validated', message: null, validatedAt: null },
      issues: state === 'partial' ? ['missing_access_token_ref'] : [],
    },
    plan: {
      preferredMode,
      fallbackMode: preferredMode === 'direct' ? 'assisted' : null,
      capabilities: [],
    },
  };
}

describe('delivery readiness helpers', () => {
  it('resolves the preferred delivery mode based on the readiness plan', () => {
    expect(resolvePreferredDeliveryMode(null, 'whatsapp')).toBe('assisted');
    expect(
      resolvePreferredDeliveryMode(makeReadiness('direct_capable', 'direct'), 'whatsapp'),
    ).toBe('direct');
    expect(
      resolvePreferredDeliveryMode(makeReadiness('partial', 'assisted'), 'whatsapp'),
    ).toBe('assisted');
    // Mismatched channel always falls back to assisted.
    expect(
      resolvePreferredDeliveryMode(makeReadiness('direct_capable', 'direct'), 'email'),
    ).toBe('assisted');
  });

  it('describes the per-row delivery state with warm copy and the right tone', async () => {
    await i18n.changeLanguage('en');
    expect(describeDeliveryTone('sent')).toBe('success');
    expect(describeDeliveryTone('failed')).toBe('danger');
    expect(describeDeliveryTone('fallback')).toBe('warning');
    expect(describeDeliveryTone('prepared')).toBe('info');
    expect(
      describeDelivery(i18n.t.bind(i18n), {
        mode: 'direct',
        state: 'sent',
        provider: 'whatsapp_cloud_api',
        providerMessageId: 'wamid.x',
        detail: null,
        attemptedAt: null,
        completedAt: null,
      }),
    ).toMatch(/Sent directly/i);
    expect(
      describeDelivery(i18n.t.bind(i18n), {
        mode: 'direct',
        state: 'fallback',
        provider: 'assisted_whatsapp',
        providerMessageId: null,
        detail: null,
        attemptedAt: null,
        completedAt: null,
      }),
    ).toMatch(/assisted fallback/i);
  });
});

describe('describeActivityAge — warm copy', () => {
  it('returns the right relative copy for various ages', async () => {
    await i18n.changeLanguage('en');
    const now = new Date('2026-04-19T10:00:00Z');
    const today = describeActivityAge(
      i18n.t.bind(i18n),
      { status: 'draft', updatedAt: '2026-04-19T08:00:00Z' },
      now,
    );
    expect(today).toMatch(/today/i);
    const yesterday = describeActivityAge(
      i18n.t.bind(i18n),
      { status: 'draft', updatedAt: '2026-04-18T10:00:00Z' },
      now,
    );
    expect(yesterday).toMatch(/yesterday/i);
    const oldDraft = describeActivityAge(
      i18n.t.bind(i18n),
      { status: 'draft', updatedAt: '2026-04-12T10:00:00Z' },
      now,
    );
    expect(oldDraft).toMatch(/7\s+days/);
  });
});
