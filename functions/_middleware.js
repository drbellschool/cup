export async function onRequest(context) {
  const password = context.env.CUP_PASSWORD;
  if (!password) {
    return new Response('Cup is not configured. Set the CUP_PASSWORD secret in Cloudflare Pages.', { status: 503 });
  }

  const auth = context.request.headers.get('Authorization') || '';
  let supplied = '';
  if (auth.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6));
      const i = decoded.indexOf(':');
      supplied = i >= 0 ? decoded.slice(i + 1) : '';
    } catch (_) {}
  }

  if (supplied !== password) {
    return new Response('Authentication required', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Cup", charset="UTF-8"',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
        'Permissions-Policy': 'camera=(self)'
      }
    });
  }

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('Permissions-Policy', 'camera=(self)');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com https://script.google.com https://script.googleusercontent.com; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; frame-src https://script.google.com https://script.googleusercontent.com; object-src 'none'; base-uri 'self'; form-action https://script.google.com https://script.googleusercontent.com");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
