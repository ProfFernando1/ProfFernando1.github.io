import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { getStudyAccount, registerStudyBankVisit, studyDisplayName, studyProfileKey, studySubject } from '../study-identity';
import { BankProblem, catalogFor, feedback, hasQuestion, practice, validChoice } from './bank';
import { performance } from './performance';
import { Profiles, TaeProblem } from './profiles';
import { serveMedia, servePage } from './storage';

export interface StudyBindings {
  DB: D1Database;
  BUCKET: R2Bucket;
}

const security = {
  'Cache-Control': 'private, no-store',
  'X-Robots-Tag': 'noindex,nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'Vary': 'Cookie'
};
const apiBase = '/concursos-tae/api/';
const canonical = 'https://fernando-coelho.proffernando.chatgpt.site';
const requestKeyPattern = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
function json(data: unknown, status=200, headers:Record<string,string>={}) {
  return Response.json(data,{status,headers:{...security,...headers}});
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const limit=8192;
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')
    throw new TaeProblem(415,'Envie um formulário JSON.');
  if (Number(request.headers.get('content-length'))>limit) throw new TaeProblem(413,'Formulário muito longo.');
  const reader=request.body?.getReader();
  if (!reader) throw new TaeProblem(400,'Formulário vazio.');
  const bytes = new Uint8Array(limit);
  let used=0;
  try {
    for (;;) {
      const part=await reader.read(); if (part.done) break;
      if (used+part.value.length>limit) { await reader.cancel(); throw new TaeProblem(413,'Formulário muito longo.'); }
      bytes.set(part.value,used);used+=part.value.length;
    }
  } finally { reader.releaseLock(); }
  try {
    const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,used)));
    if (data && typeof data==='object' && !Array.isArray(data)) return data;
  } catch { /* Return the same message for incomplete and malformed input. */ }
  throw new TaeProblem(400,'Formulário inválido.');
}

export async function handleStudy(request: Request, env: StudyBindings): Promise<Response> {
  try {
    const url=new URL(request.url);
    let path: string;
    try { path=decodeURIComponent(url.pathname).replace(/\/+$/,''); }
    catch { throw new TaeProblem(400,'Endereço inválido.'); }
    const media=path.startsWith('/concursos-tae/media/');
    const route=path.startsWith(apiBase)?path.slice(apiBase.length):'';
    const write=request.method==='POST';
    if (write) {
      const origin=request.headers.get('Origin');
      if(request.headers.get('sec-fetch-site')==='cross-site' || (route==='enter' && !origin) || (origin && origin!==url.origin && origin!==canonical))
        throw new TaeProblem(403,'Abra o caderno para enviar sua resposta.');
    } else if (!['GET','HEAD'].includes(request.method)) return json({error:'Método inválido.'},405,{Allow:'GET, HEAD, POST'});
    if (!write && route==='health') return json({app:'caderno-tae-rs',ready:true});
    if (media) return serveMedia(env.BUCKET,path.slice('/concursos-tae/'.length),request);
    if (!write && route==='page-image')
      return servePage(env.BUCKET,url.searchParams.get('exam')||'',Number(url.searchParams.get('page')),request);

    const subject = url.searchParams.get('guest')==='1' ? null : studySubject(request.headers);
    if (!write && route==='session')
      return json(subject ? {
        authenticated: true,
        profileId: await studyProfileKey(subject),
        displayName: studyDisplayName(request.headers),
      } : { authenticated: false });

    const expectedProfile = request.headers.get('X-Study-Profile');
    const readsProgress = (!write && route==='performance') ||
      (Boolean(expectedProfile) && (route==='practice' || (!write && route==='catalog')));
    const writesProgress = write && ['enter','save','answer'].includes(route);
    if (readsProgress || writesProgress) {
      if (!subject) throw new TaeProblem(401,'Entre com o ChatGPT para acessar seu progresso.');
      if (expectedProfile!==await studyProfileKey(subject))
        throw new TaeProblem(409,'A conta conectada mudou. Volte às opções de acesso para entrar novamente.');
    }

    if (write && route==='enter' && subject) {
      await registerStudyBankVisit(env.DB,subject,'tae',studyDisplayName(request.headers));
      return json({ok:true});
    }

    const profiles=new Profiles(env.DB);
    if (write && ['save','answer','check'].includes(route)) {
      const form = await body(request);
      const question = form.id;
      if (typeof question!=='string' || !hasQuestion(question)) throw new TaeProblem(404,'Questão não encontrada.');
      if (route==='save' && subject) {
        if (typeof form.saved!=='boolean') throw new TaeProblem(400,'Seleção inválida.');
        const uid = await getStudyAccount(env.DB,subject,true,studyDisplayName(request.headers));
        if (uid===null) throw new Error('Falha ao registrar perfil.');
        return json(await profiles.save(uid,question,form.saved));
      }
      const choice = form.choice;
      if (!validChoice(question,choice)) throw new TaeProblem(400,'Selecione uma alternativa válida.');
      const mark = await feedback(env.BUCKET,question,choice);
      if (!mark) throw new TaeProblem(404,'Questão não encontrada.');
      if (route==='answer' && subject) {
        if (typeof form.request!=='string' || !requestKeyPattern.test(form.request))
          throw new TaeProblem(400,'Identificador de resposta inválido.');
        const uid = await getStudyAccount(env.DB,subject,true,studyDisplayName(request.headers));
        if (uid===null) throw new Error('Falha ao registrar perfil.');
        const recorded = await profiles.record(uid,question,choice,form.request);
        return json({ ...mark, ...recorded });
      }
      return json(mark);
    }
    if (!write && route==='performance') {
      const uid = subject ? await getStudyAccount(env.DB,subject) : null;
      return json(await performance(env.DB,uid,Math.max(0,Number.parseInt(url.searchParams.get('offset')||'0',10)||0)));
    }
    if ((!write && route==='catalog') || route==='practice') {
      const uid = subject && readsProgress ? await getStudyAccount(env.DB,subject) : null;
      if (route==='catalog') {
        if (!readsProgress) return json(catalogFor(null));
        const { resume, progress } = await profiles.overview(uid);
        return json({ ...catalogFor(resume), progress });
      }
      let params = url.searchParams;
      if (write) {
        const form = await body(request);
        if (typeof form.query!=='string') throw new TaeProblem(400,'Seleção inválida.');
        params = new URLSearchParams(form.query);
      }
      const snapshot = await profiles.snapshot(uid);
      return json(await practice(env.BUCKET,params,snapshot.latest,snapshot.favorites));
    }
    return json({error:'Recurso não encontrado.'},404);
  }catch(error){
    if(error instanceof TaeProblem || error instanceof BankProblem){
      return json({error:error.message},error.status);
    }
    console.error('Falha no caderno de concursos', error instanceof Error?error.name:'erro');
    return json({error:'O caderno está temporariamente indisponível. Tente novamente.'},503);
  }
}

