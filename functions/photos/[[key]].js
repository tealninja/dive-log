export async function onRequest(context) {
  const { params, env } = context;
  const key = Array.isArray(params.key) ? params.key.join('/') : params.key;
  if (!key) return new Response('Missing key', { status: 400 });

  const obj = await env.PHOTOS.get(key);
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('etag', obj.httpEtag);
  return new Response(obj.body, { headers });
}
