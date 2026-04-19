#!/usr/bin/env node
/**
 * Pure unit smoke for the WhatsApp Cloud API live delivery pack
 * (Wave 16).  Exercises the compiled `WhatsAppCloudApiClient` and
 * `WhatsAppCloudApiProvider` against an in-memory fetch / readiness
 * fixture so we can verify honest delivery state transitions without
 * booting Nest or hitting Meta.
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const distRoot = resolve(here, '..', 'apps', 'api', 'dist', 'modules', 'communication', 'delivery');
const clientPath = resolve(distRoot, 'whatsapp-cloud-api.client.js');
const providerPath = resolve(distRoot, 'whatsapp-cloud-api-provider.js');
const orchestratorPath = resolve(distRoot, 'communication-delivery.service.js');
const assistedPath = resolve(distRoot, 'assisted-provider.js');

for (const path of [clientPath, providerPath, orchestratorPath, assistedPath]) {
  if (!existsSync(path)) {
    console.error('whatsapp-cloud-delivery.test could not find compiled module at', path);
    console.error('Run `npm run build` before running this check.');
    process.exit(1);
  }
}

const {
  WhatsAppCloudApiClient,
  WHATSAPP_CLOUD_API_FETCHER,
  defaultWhatsAppFetcher,
} = await import(pathToFileURL(clientPath).href);
const { WhatsAppCloudApiProvider } = await import(pathToFileURL(providerPath).href);
const { CommunicationDeliveryService } = await import(pathToFileURL(orchestratorPath).href);
const { AssistedDeliveryProvider } = await import(pathToFileURL(assistedPath).href);
const { Module } = await import('@nestjs/common');
const { NestFactory } = await import('@nestjs/core');

function makeFetcher(handler) {
  return async (url, init) => handler(url, init);
}

function makeReadiness(state, { token = 'live-token', phoneNumberId = '1234567890' } = {}) {
  const summary = {
    state,
    directSendAvailable: state === 'direct_capable',
    cloudApiEnabled: state !== 'not_configured' && state !== 'assisted_only',
    configured: { phoneNumberId: true, businessAccountId: true, accessTokenRef: true },
    displayPhoneNumber: '+90 555 000 0000',
    validation: { state: 'ok', message: null, validatedAt: null },
    issues: [],
  };
  return {
    async getSummary() {
      return summary;
    },
    async getResolvedConfig() {
      return {
        summary,
        phoneNumberId: state === 'direct_capable' ? phoneNumberId : null,
        accessToken: state === 'direct_capable' ? token : null,
      };
    },
  };
}

const recipients = [
  {
    athleteId: 'a1',
    athleteName: 'Deniz',
    guardianId: 'g1',
    guardianName: 'Ayşe',
    phone: '+90 555 111 2233',
    email: null,
    message: 'Hi Ayşe — gentle reminder.',
  },
  {
    athleteId: 'a2',
    athleteName: 'Mert',
    guardianId: 'g2',
    guardianName: 'Hakan',
    phone: '+90 555 444 5566',
    email: null,
    message: 'Hi Hakan — gentle reminder.',
  },
];

const tests = [];

tests.push([
  'client extracts wamid from a 200 response',
  async () => {
    const client = new WhatsAppCloudApiClient(
      makeFetcher(async () => ({
        ok: true,
        status: 200,
        async json() {
          return { messages: [{ id: 'wamid.ABC123' }] };
        },
        async text() {
          return '';
        },
      })),
    );
    const result = await client.sendText({
      accessToken: 't',
      phoneNumberId: '123',
      toPhoneE164: '90555',
      body: 'hi',
    });
    assert.equal(result.ok, true);
    assert.equal(result.providerMessageId, 'wamid.ABC123');
  },
]);

tests.push([
  'client classifies a 401 as token_invalid',
  async () => {
    const client = new WhatsAppCloudApiClient(
      makeFetcher(async () => ({
        ok: false,
        status: 401,
        async json() {
          return { error: { code: 190, message: 'token expired' } };
        },
        async text() {
          return '';
        },
      })),
    );
    const result = await client.sendText({
      accessToken: 't',
      phoneNumberId: '123',
      toPhoneE164: '90555',
      body: 'hi',
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'token_invalid');
  },
]);

tests.push([
  'client classifies a 429 as rate_limited',
  async () => {
    const client = new WhatsAppCloudApiClient(
      makeFetcher(async () => ({
        ok: false,
        status: 429,
        async json() {
          return {};
        },
        async text() {
          return '';
        },
      })),
    );
    const result = await client.sendText({
      accessToken: 't',
      phoneNumberId: '123',
      toPhoneE164: '90555',
      body: 'hi',
    });
    assert.equal(result.errorCode, 'rate_limited');
  },
]);

tests.push([
  'client classifies a transport throw as transport_error and never throws',
  async () => {
    const client = new WhatsAppCloudApiClient(
      makeFetcher(async () => {
        throw new Error('network down');
      }),
    );
    const result = await client.sendText({
      accessToken: 't',
      phoneNumberId: '123',
      toPhoneE164: '90555',
      body: 'hi',
    });
    assert.equal(result.ok, false);
    assert.equal(result.errorCode, 'transport_error');
  },
]);

tests.push([
  'provider returns sent when all recipients deliver',
  async () => {
    const fakeClient = {
      async sendText() {
        return {
          ok: true,
          providerMessageId: 'wamid.x',
          raw: {},
        };
      },
    };
    const provider = new WhatsAppCloudApiProvider(makeReadiness('direct_capable'), fakeClient);
    const result = await provider.deliver({
      tenantId: 't1',
      channel: 'whatsapp',
      topic: 'Reminder',
      recipients,
    });
    assert.equal(result.state, 'sent');
    assert.equal(result.recipients.length, 2);
    assert.equal(
      result.recipients.every((r) => r.state === 'sent'),
      true,
    );
  },
]);

tests.push([
  'provider returns failed when all recipients fail',
  async () => {
    const fakeClient = {
      async sendText() {
        return {
          ok: false,
          providerMessageId: null,
          errorCode: 'token_invalid',
          errorMessage: 'token_invalid',
          raw: {},
        };
      },
    };
    const provider = new WhatsAppCloudApiProvider(makeReadiness('direct_capable'), fakeClient);
    const result = await provider.deliver({
      tenantId: 't1',
      channel: 'whatsapp',
      topic: 'Reminder',
      recipients,
    });
    assert.equal(result.state, 'failed');
    assert.equal(result.detail, 'token_invalid');
    assert.equal(result.recipients.every((r) => r.state === 'failed'), true);
  },
]);

tests.push([
  'provider produces an honest partial_sent state on mixed outcomes',
  async () => {
    let call = 0;
    const fakeClient = {
      async sendText() {
        call += 1;
        if (call === 1) {
          return { ok: true, providerMessageId: 'wamid.x', raw: {} };
        }
        return {
          ok: false,
          providerMessageId: null,
          errorCode: 'rate_limited',
          errorMessage: 'rate_limited',
          raw: {},
        };
      },
    };
    const provider = new WhatsAppCloudApiProvider(makeReadiness('direct_capable'), fakeClient);
    const result = await provider.deliver({
      tenantId: 't1',
      channel: 'whatsapp',
      topic: 'Reminder',
      recipients,
    });
    assert.equal(result.state, 'sent');
    assert.match(result.detail, /partial_sent:1_of_2/);
    assert.equal(result.recipients.filter((r) => r.state === 'sent').length, 1);
    assert.equal(result.recipients.filter((r) => r.state === 'failed').length, 1);
  },
]);

tests.push([
  'provider refuses to attempt a send when readiness is not direct_capable',
  async () => {
    const fakeClient = {
      async sendText() {
        throw new Error('should not be called');
      },
    };
    const provider = new WhatsAppCloudApiProvider(makeReadiness('partial'), fakeClient);
    const result = await provider.deliver({
      tenantId: 't1',
      channel: 'whatsapp',
      topic: 'Reminder',
      recipients,
    });
    assert.equal(result.state, 'failed');
    assert.equal(result.detail, 'cloud_api_not_ready');
  },
]);

tests.push([
  'orchestrator falls back to assisted when direct fails end-to-end',
  async () => {
    const fakeClient = {
      async sendText() {
        return {
          ok: false,
          providerMessageId: null,
          errorCode: 'token_invalid',
          errorMessage: 'token_invalid',
          raw: {},
        };
      },
    };
    const provider = new WhatsAppCloudApiProvider(makeReadiness('direct_capable'), fakeClient);
    const orchestrator = new CommunicationDeliveryService(
      makeReadiness('direct_capable'),
      new AssistedDeliveryProvider(),
      provider,
    );
    const result = await orchestrator.deliver('direct', {
      tenantId: 't1',
      channel: 'whatsapp',
      topic: 'Reminder',
      recipients,
    });
    assert.equal(result.state, 'fallback');
    assert.match(result.detail, /direct_failed/);
  },
]);

tests.push([
  'orchestrator returns sent (with partial detail) when at least one recipient delivered',
  async () => {
    let call = 0;
    const fakeClient = {
      async sendText() {
        call += 1;
        if (call === 1) {
          return { ok: true, providerMessageId: 'wamid.x', raw: {} };
        }
        return {
          ok: false,
          providerMessageId: null,
          errorCode: 'rate_limited',
          errorMessage: 'rate_limited',
          raw: {},
        };
      },
    };
    const provider = new WhatsAppCloudApiProvider(makeReadiness('direct_capable'), fakeClient);
    const orchestrator = new CommunicationDeliveryService(
      makeReadiness('direct_capable'),
      new AssistedDeliveryProvider(),
      provider,
    );
    const result = await orchestrator.deliver('direct', {
      tenantId: 't1',
      channel: 'whatsapp',
      topic: 'Reminder',
      recipients,
    });
    assert.equal(result.state, 'sent');
    assert.match(result.detail, /partial_sent/);
  },
]);

tests.push([
  'orchestrator falls back when readiness is not direct_capable, never calling the client',
  async () => {
    let called = false;
    const fakeClient = {
      async sendText() {
        called = true;
        return { ok: true, providerMessageId: 'wamid.x', raw: {} };
      },
    };
    const provider = new WhatsAppCloudApiProvider(makeReadiness('partial'), fakeClient);
    const orchestrator = new CommunicationDeliveryService(
      makeReadiness('partial'),
      new AssistedDeliveryProvider(),
      provider,
    );
    const result = await orchestrator.deliver('direct', {
      tenantId: 't1',
      channel: 'whatsapp',
      topic: 'Reminder',
      recipients,
    });
    assert.equal(called, false);
    assert.equal(result.state, 'fallback');
  },
]);

tests.push([
  'WhatsAppCloudApiClient can be resolved by Nest when the fetcher token is provided',
  async () => {
    class CommunicationDIRegressionModule {}
    Module({
      providers: [
        { provide: WHATSAPP_CLOUD_API_FETCHER, useValue: defaultWhatsAppFetcher },
        WhatsAppCloudApiClient,
      ],
    })(CommunicationDIRegressionModule);

    const app = await NestFactory.createApplicationContext(CommunicationDIRegressionModule, {
      logger: false,
      abortOnError: false,
    });
    try {
      const instance = app.get(WhatsAppCloudApiClient);
      assert.ok(instance instanceof WhatsAppCloudApiClient);
    } finally {
      await app.close();
    }
  },
]);

tests.push([
  'WhatsAppCloudApiClient still resolves with @Optional fetcher when the token is absent',
  async () => {
    class StandaloneClientModule {}
    Module({ providers: [WhatsAppCloudApiClient] })(StandaloneClientModule);

    const app = await NestFactory.createApplicationContext(StandaloneClientModule, {
      logger: false,
      abortOnError: false,
    });
    try {
      const instance = app.get(WhatsAppCloudApiClient);
      assert.ok(instance instanceof WhatsAppCloudApiClient);
    } finally {
      await app.close();
    }
  },
]);

let failures = 0;
for (const [name, run] of tests) {
  try {
    await run();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`  ✗ ${name}: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`\nwhatsapp-cloud-delivery.test failed (${failures} cases).`);
  process.exit(1);
}
console.log('\nwhatsapp-cloud-delivery.test passed.');
