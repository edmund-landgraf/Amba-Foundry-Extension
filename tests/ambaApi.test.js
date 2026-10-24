import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBaseUrl, makeAmbaClient, asArray, itemId } from '../scripts/ambaApi.js';

test('normalizes server origin and rejects unsafe URL forms', () => {
  assert.equal(normalizeBaseUrl('http://localhost:5190/'), 'http://localhost:5190');
  assert.throws(() => normalizeBaseUrl('javascript:alert(1)'));
  assert.throws(() => normalizeBaseUrl('https://user:secret@example.org'));
});
test('encodes path segments and checks response', async () => {
  let path;
  const client = makeAmbaClient('https://example.org', async (url, opts) => {
    path = url;
    assert.equal(opts.credentials, 'include');
    return { ok: true, json: async () => ({ encounters: [] }) };
  });
  await client.listEncounters('a/b');
  assert.equal(path, 'https://example.org/api/modules/a%2Fb/encounters');
});
test('extracts flexible list shapes and stable ID', () => {
  assert.deepEqual(asArray({ encounters: [{ id: 1 }] }, ['encounters']), [{ id: 1 }]);
  assert.equal(itemId({ slug: 'ambush' }), 'ambush');
});
