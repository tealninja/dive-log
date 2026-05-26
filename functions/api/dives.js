import { isOwner, json } from '../_auth.js';

const COLS = [
  'diver_id','site','location','dive_num','date','surface_int',
  'time_in','time_out','lat','lng','max_depth_ft','avg_depth_ft',
  'water_temp_f','viz_ft','start_psi','end_psi','tank_size','tank_pressure',
  'tank_mat','gas','weight_lbs','suit','conditions','site_tags',
  'critters','buddies','photos','notes',
];
const JSON_COLS = new Set(['conditions','site_tags','critters','buddies','photos']);

function rowToDive(r) {
  const out = { ...r };
  for (const c of JSON_COLS) {
    try { out[c] = r[c] ? JSON.parse(r[c]) : []; }
    catch { out[c] = []; }
  }
  return out;
}

function diveToRow(body) {
  const row = {};
  for (const c of COLS) {
    let v = body[c];
    if (v === undefined) { row[c] = null; continue; }
    if (JSON_COLS.has(c)) {
      row[c] = Array.isArray(v) ? JSON.stringify(v) : (v ? String(v) : null);
    } else if (v === '') {
      row[c] = null;
    } else {
      row[c] = v;
    }
  }
  return row;
}

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
      'SELECT * FROM dives ORDER BY date DESC, time_in DESC, id DESC'
    ).all();
    return json((results || []).map(rowToDive));
  }

  if (method === 'POST') {
    if (!isOwner(request, env)) return json({ error: 'Forbidden' }, 403);
    const body = await request.json();
    if (!body.date) return json({ error: 'date required' }, 400);
    const row = diveToRow(body);
    const placeholders = COLS.map(() => '?').join(',');
    const stmt = `INSERT INTO dives (${COLS.join(',')}) VALUES (${placeholders})`;
    const result = await env.DB.prepare(stmt).bind(...COLS.map(c => row[c])).run();
    const id = result.meta.last_row_id;
    const inserted = await env.DB.prepare('SELECT * FROM dives WHERE id = ?').bind(id).first();
    return json(rowToDive(inserted), 201);
  }

  if (method === 'PUT') {
    if (!isOwner(request, env)) return json({ error: 'Forbidden' }, 403);
    const body = await request.json();
    const id = body.id;
    if (!id) return json({ error: 'id required' }, 400);
    const row = diveToRow(body);
    const setClause = COLS.map(c => `${c} = ?`).join(', ');
    const stmt = `UPDATE dives SET ${setClause}, updated_at = datetime('now') WHERE id = ?`;
    await env.DB.prepare(stmt).bind(...COLS.map(c => row[c]), id).run();
    const updated = await env.DB.prepare('SELECT * FROM dives WHERE id = ?').bind(id).first();
    if (!updated) return json({ error: 'not found' }, 404);
    return json(rowToDive(updated));
  }

  if (method === 'DELETE') {
    if (!isOwner(request, env)) return json({ error: 'Forbidden' }, 403);
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'id required' }, 400);
    const row = await env.DB.prepare('SELECT photos FROM dives WHERE id = ?').bind(id).first();
    if (row && row.photos) {
      try {
        const keys = JSON.parse(row.photos);
        if (Array.isArray(keys)) {
          await Promise.all(keys.map(k => env.PHOTOS.delete(k).catch(() => {})));
        }
      } catch {}
    }
    await env.DB.prepare('DELETE FROM dives WHERE id = ?').bind(id).run();
    return json({ deleted: true });
  }

  return json({ error: 'Method not allowed' }, 405);
}
