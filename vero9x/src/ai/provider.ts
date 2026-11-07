import { env } from '../config/env';

export interface ChatMessage { role: 'user' | 'assistant'; content: string }

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`AI provider returned HTTP ${res.status}`);
  return res.json();
}

/** Calls the configured provider. Throws on failure (caller handles it). */
export async function generate(system: string, messages: ChatMessage[]): Promise<string> {
  const { provider, apiKey, model, baseUrl } = env.ai;
  if (!apiKey) throw new Error('AI_API_KEY is not configured');

  if (provider === 'anthropic') {
    const data = await post(`${baseUrl || 'https://api.anthropic.com'}/v1/messages`,
      { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      { model, max_tokens: 400, system, messages });
    return (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
  }
  const data = await post(`${baseUrl || 'https://api.openai.com/v1'}/chat/completions`,
    { authorization: `Bearer ${apiKey}` },
    { model, max_tokens: 400, messages: [{ role: 'system', content: system }, ...messages] });
  return (data.choices?.[0]?.message?.content ?? '').trim();
}
