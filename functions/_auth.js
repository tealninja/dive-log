export function isOwner(request, env) {
  const token = request.headers.get('X-Owner-Token');
  return token && token === env.OWNER_TOKEN;
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
