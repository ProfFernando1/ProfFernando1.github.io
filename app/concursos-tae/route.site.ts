import { studySubject } from '@/lib/study-identity';
import { studyCanonical, studyShell } from '@/lib/tae/shell';

export const dynamic = 'force-dynamic';
export function GET(request: Request) {
  const anonymous = !studySubject(request.headers);
  const indexable = anonymous && !request.url.split('#', 1)[0].includes('?');
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'Vary': 'Cookie, oai-authenticated-user-id',
    'X-Robots-Tag': indexable ? 'index,follow' : 'noindex,nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
  });
  if (indexable) headers.set('Link', '<' + studyCanonical + '>; rel="canonical"');
  return new Response(request.method === 'HEAD' ? null : studyShell(anonymous, indexable), { headers });
}

export { GET as HEAD };
