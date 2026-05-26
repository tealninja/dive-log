import { isOwner, json } from '../_auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Owner-Token',
      },
    });
  }

  if (method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM dives ORDER BY date DESC, id DESC'
    ).all();
    return json(results);
  }

  if (method === 'POST') {
    if (!isOwner(request, env)) return json({ error: 'Forbidden' }, 403);
    const body = await request.json();
    const { date, location, depth_m, duration_min, notes, photo_key } = body;
    if (!date || !location) return json({ error: 'date and location required' }, 400);
    const result = await env.DB.prepare(
      'INSERT INTO dives (date, location, depth_m, duration_min, notes, photo_key) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(date, location, depth_m ?? null, duration_min ?? null, notes ?? null, photo_key ?? null).run();
    return json({ id: result.meta.last_row_id }, 201);
  }

  if (method === 'DELETE') {
    if (!isOwner(request, env)) return json({ error: 'Forbidden' }, 403);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id required' }, 400);
    await env.DB.prepare('DELETE FROM dives WHERE id = ?').bind(id).run();
    return json({ deleted: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
