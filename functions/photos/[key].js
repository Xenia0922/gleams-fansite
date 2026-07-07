/**
 * GET /photos/* — 代理 R2 存储的图片
 */
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = url.pathname.replace('/photos/', '');

  try {
    const obj = await env.PHOTOS.get(key);
    if (!obj) {
      return new Response('Not found', { status: 404 });
    }
    const headers = new Headers();
    obj.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', '*');
    return new Response(obj.body, { headers });
  } catch {
    return new Response('Error', { status: 500 });
  }
}
