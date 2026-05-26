import { isOwner, json } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Owner-Token',
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isOwner(request, env)) return json({ error: 'Forbidden' }, 403);

  const formData = await request.formData();
  const file = formData.get('file');
  if (!file) return json({ error: 'No file provided' }, 400);

  const key = `${Date.now()}-${file.name}`;
  await env.PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  return json({ key });
}
