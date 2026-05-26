// Single Worker entry. Routes /api/* + /photos/* and falls through to static assets.

const COLS = [
  'diver_id','site','location','dive_num','date','surface_int',
  'time_in','time_out','lat','lng','max_depth_ft','avg_depth_ft',
  'water_temp_f','viz_ft','start_psi','end_psi','tank_size','tank_pressure',
  'tank_mat','gas','weight_lbs','suit','conditions','site_tags',
  'critters','buddies','photos','notes',
];
const JSON_COLS = new Set(['conditions','site_tags','critters','buddies','photos']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Owner-Token',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

function isOwner(request, env) {
  const token = request.headers.get('X-Owner-Token');
  return !!(token && env.OWNER_TOKEN && token === env.OWNER_TOKEN);
}

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

async function handleDives(request, env) {
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

async function handleDivers(request, env) {
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

async function handleUpload(request, env) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
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

async function handlePhotos(request, env, key) {
  if (!key) return new Response('Missing key', { status: 400 });
  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('etag', obj.httpEtag);
  return new Response(obj.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/dives')   return handleDives(request, env);
    if (path === '/api/divers')  return handleDivers(request, env);
    if (path === '/api/upload')  return handleUpload(request, env);
    if (path.startsWith('/photos/')) {
      const key = decodeURIComponent(path.slice('/photos/'.length));
      return handlePhotos(request, env, key);
    }

    return env.ASSETS.fetch(request);
  },
};
