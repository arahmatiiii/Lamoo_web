/**
 * Lamoo — Ollama Cloud CORS proxy.
 *
 * Ollama Cloud's API (ollama.com) does not send CORS headers, so browsers
 * block direct requests from the app. This Worker is a stateless passthrough:
 * it forwards the request body and Authorization header straight to Ollama
 * and relays the response back with CORS headers added — nothing is read,
 * logged, or stored.
 *
 * Deploy: dash.cloudflare.com → Workers & Pages → Create → Create Worker →
 * paste this file in the online editor → Deploy. Copy the resulting
 * "*.workers.dev" URL into Lamoo → Settings → AI → Ollama → Proxy URL.
 */

const OLLAMA_CHAT_URL = 'https://ollama.com/api/chat';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const upstream = await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: request.headers.get('Authorization') || '',
      },
      body: await request.text(),
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
    });
  },
};
