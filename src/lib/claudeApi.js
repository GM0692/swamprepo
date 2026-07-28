import { sGet } from './storage.js';

// Outside the Claude.ai artifact sandbox, there's no built-in bridge to the
// Anthropic API — this app calls it directly from the browser using an API
// key you provide in Settings. That key is stored only in this browser's
// localStorage and is sent straight to api.anthropic.com; it never touches
// any server of ours. Because this is a client-side call, the key is
// visible to anyone with access to this browser/device — fine for a
// personal tool on your own machine, but don't deploy this build publicly
// with your key embedded, and don't share this browser profile.
//
// For a shared/deployed version, swap this for a small server-side proxy
// (a single serverless function that holds the key) instead of calling
// the API directly from the client.

const DEFAULT_MODEL = 'claude-sonnet-5';

export async function askClaude(userPrompt, systemPrompt) {
  const apiKey = await sGet('settings:anthropicApiKey', '');
  const model = (await sGet('settings:model', '')) || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error('Add your Anthropic API key in Settings to use AI suggestions.');
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic API request failed (${res.status}).`);
  }
  if (data?.content) {
    return data.content.map((b) => b.text || '').join('\n').trim();
  }
  throw new Error('Unexpected response from the Anthropic API.');
}
