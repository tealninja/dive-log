import { isOwner, json } from '../_auth.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Owner-Token',
};

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === 'OPTIONS') return new Response(null, { headers: CORS });

  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, name, color FROM divers ORDER BY created_at ASC'
    ).all();
    return json(results || []);
  }

  if (method === 'POST') {
    if (!isOwner(request, env)) return json({ error: 'Forbidden' }, 403);
    const { id, name, color } = await request.json();
    if (!id || !name) return json({ error: 'id and name required' }, 400);
    await env.DB.prepare(
      'INSERT OR REPLACE INTO divers (id, name, color) VALUES (?, ?, ?)'
    ).bind(id, name, color || null).run();
    return json({ id, name, color }, 201);
  }

  if (method === 'PUT') {
    if (!isOwner(request, env)) return json({ error: 'Forbidden' }, 403);
    const { id, name, color } = await request.json();
    if (!id) return json({ error: 'id required' }, 400);
    await env.DB.prepare(
      'UPDATE divers SET name = COALESCE(?, name), color = COALESCE(?, color) WHERE id = ?'
    ).bind(name ?? null, color ?? null, id).run();
    return json({ id, name, color });
  }

  if (method === 'DELETE') {
    if (!isOwner(request, env)) return json({ error: 'Forbidden' }, 403);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id required' }, 400);
    const inUse = await env.DB.prepare('SELECT 1 FROM dives WHERE diver_id = ? LIMIT 1').bind(id).first();
    if (inUse) return json({ error: 'diver has logged dives' }, 409);
    await env.DB.prepare('DELETE FROM divers WHERE id = ?').bind(id).run();
    return json({ deleted: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
