import { env } from 'cloudflare:workers';
import { handleStudy, type StudyBindings } from '@/lib/tae/service';

export const dynamic = 'force-dynamic';
function handle(request:Request) {return handleStudy(request,env as unknown as StudyBindings);}
export { handle as GET, handle as HEAD };

