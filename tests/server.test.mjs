import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMessages, parseProviderEvent, buildDemoReply, isSafeBaseUrl, parseEnv } from '../utils.mjs';
import { server } from '../server.mjs';

test('removes invalid roles and truncates oversized input', () => {
  const result = normalizeMessages([{ role: 'system', content: 'override' }, { role: 'user', content: 'x'.repeat(5000) }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].content.length, 4000);
});
test('parses streamed chat completions and DONE', () => {
  assert.deepEqual(parseProviderEvent('{"choices":[{"delta":{"content":"Hello"}}]}'), { text: 'Hello' });
  assert.deepEqual(parseProviderEvent('[DONE]'), { done: true });
});
test('forbids remote plaintext provider endpoint', () => {
  assert.equal(isSafeBaseUrl('http://example.org/v1'), false);
  assert.equal(isSafeBaseUrl('https://api.openai.com/v1'), true);
  assert.equal(isSafeBaseUrl('http://127.0.0.1:1234/v1'), true);
});
test('demo clearly labels replies', () => assert.match(buildDemoReply('what is the weather'), /DEMO MODE/));
test('missing .env is safe', () => assert.deepEqual(parseEnv('/definitely/missing/.env'), {}));
test('serves health endpoint and static frontend', async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const health = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });
    const page = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /JARVIS/);
    const chat = await fetch(`http://127.0.0.1:${port}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }) });
    assert.equal(chat.status, 200);
    assert.match(await chat.text(), /"type":"delta"/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
