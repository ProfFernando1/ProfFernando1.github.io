import { env } from 'cloudflare:workers';
import { handleBlog, type BlogEnv } from '@/lib/blog-service';

export const dynamic = 'force-dynamic';
function handle(request: Request) { return handleBlog(request, env as unknown as BlogEnv); }
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE, handle as OPTIONS };
