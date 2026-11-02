import fs from 'node:fs';

export function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[match[1]] = value;
  }
  return out;
}
export function normalizeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input.filter(x => x && (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string')
    .slice(-24).map(x => ({ role: x.role, content: x.content.slice(0, 4000) }))
    .filter(x => x.content.trim().length);
}
export function isSafeBaseUrl(base) {
  try {
    const url = new URL(base);
    return (url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
export function parseProviderEvent(value) {
  if (value === '[DONE]') return { done: true };
  try {
    const payload = JSON.parse(value);
    const text = payload.choices?.[0]?.delta?.content;
    return typeof text === 'string' && text ? { text } : null;
  } catch { return null; }
}
export function buildDemoReply(text) {
  const lower = text.toLowerCase();
  if (/^(hi|hey|hello|salam|سلام|السلام|مرحبا)/.test(lower)) return 'Hello! I am JARVIS. You are currently in DEMO mode. I can help you organize notes, tasks, conversations, and voice interactions. To enable real AI replies, add your API key in the server .env file.';
  if (/\b(task|todo|remind|plan)\b|مهمة|مهام|تذكرني/.test(lower)) return 'You can manage tasks from the TASKS section. You can also type “create task finish project” directly here. This is a demonstration response; add an API key to enable real AI assistance.';
  if (/\b(note|remember|memory)\b|ملاحظة|تذكر|حفظ/.test(lower)) return 'You can save notes and personal memory from the NOTES and MEMORY sections. Try “remember I prefer concise answers” to save a fact locally. Real AI chat becomes available after you configure your API key.';
  return 'JARVIS DEMO MODE — I received your message, but a live AI model is not connected yet. The dashboard, local chat history, notes, tasks, memory, and supported browser voice controls are ready. To enable real AI answers, create a .env file with AI_API_KEY, then restart the server.';
}
