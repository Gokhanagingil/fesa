import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(__filename), '..');
const apiDist = path.join(workspaceRoot, 'apps', 'api', 'dist');

async function loadMediaService() {
  const compiled = pathToFileURL(path.join(apiDist, 'modules', 'media', 'media-storage.service.js'));
  return import(compiled.href);
}

function makeConfigStub(root) {
  return { get: () => root };
}

async function main() {
  const tempRoot = await mkdtemp(path.join(tmpdir(), 'amateur-media-test-'));
  try {
    const { MediaStorageService, MAX_PHOTO_SIZE_BYTES, ALLOWED_PHOTO_MIME_TYPES } = await loadMediaService();
    assert.equal(typeof MAX_PHOTO_SIZE_BYTES, 'number');
    assert.ok(Array.isArray(ALLOWED_PHOTO_MIME_TYPES) && ALLOWED_PHOTO_MIME_TYPES.length >= 4);

    const svc = new MediaStorageService(makeConfigStub(tempRoot));
    assert.equal(svc.getStorageRoot(), tempRoot);

    const tenantA = '00000000-0000-0000-0000-00000000000a';
    const tenantB = '00000000-0000-0000-0000-00000000000b';
    const athleteA = '11111111-1111-1111-1111-111111111111';
    const athleteB = '22222222-2222-2222-2222-222222222222';

    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const stored = await svc.storePhoto(tenantA, 'athletes', athleteA, buffer, 'image/jpeg');
    assert.match(stored.fileName, /\.jpg$/);
    assert.equal(stored.contentType, 'image/jpeg');
    assert.equal(stored.sizeBytes, 4);

    const resolved = svc.resolveExistingFile(tenantA, 'athletes', athleteA, stored.fileName);
    assert.ok(resolved && resolved.startsWith(tempRoot), 'resolved path must stay inside the storage root');
    const onDisk = await readFile(resolved);
    assert.deepEqual(Array.from(onDisk), Array.from(buffer));

    // Tenant B must never see tenant A's file even with the same fileName.
    const crossTenant = svc.resolveExistingFile(tenantB, 'athletes', athleteA, stored.fileName);
    assert.equal(crossTenant, null, 'tenant isolation: cross-tenant lookup must return null');

    // Path traversal attempts must be rejected before touching the filesystem.
    assert.throws(() => svc.resolveExistingFile(tenantA, 'athletes', athleteA, '../escape.jpg'));
    assert.throws(() => svc.resolveExistingFile(tenantA, 'athletes', '../etc', stored.fileName));

    // Validation rules.
    assert.throws(() => svc.assertValidPhoto(undefined, 'image/jpeg'), /No photo file received/);
    assert.throws(() => svc.assertValidPhoto(Buffer.from([0]), 'application/pdf'), /Unsupported file type/);
    const tooBig = Buffer.alloc(MAX_PHOTO_SIZE_BYTES + 1);
    assert.throws(() => svc.assertValidPhoto(tooBig, 'image/jpeg'), /larger than 5 MB/);

    // Replace + remove should clean up the previous file.
    const second = await svc.storePhoto(tenantA, 'athletes', athleteA, Buffer.from([0xff]), 'image/png');
    assert.match(second.fileName, /\.png$/);
    await svc.removeFile(tenantA, 'athletes', athleteA, stored.fileName);
    assert.equal(svc.resolveExistingFile(tenantA, 'athletes', athleteA, stored.fileName), null);
    // Active file should still exist.
    const stillThere = svc.resolveExistingFile(tenantA, 'athletes', athleteA, second.fileName);
    assert.ok(stillThere);
    await stat(stillThere);

    // Removing an athlete's only file should also be safe (no throw) and leave the dir tidy.
    await svc.removeFile(tenantA, 'athletes', athleteA, second.fileName);
    assert.equal(svc.resolveExistingFile(tenantA, 'athletes', athleteA, second.fileName), null);

    // Independent isolation: store for tenant B / athlete B is in a different folder tree.
    const otherStored = await svc.storePhoto(tenantB, 'athletes', athleteB, Buffer.from([0xff]), 'image/webp');
    assert.match(otherStored.fileName, /\.webp$/);

    console.log('media storage isolation OK');
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
