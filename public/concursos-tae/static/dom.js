export const root='/concursos-tae/';
export const $=selector=>document.querySelector(selector);
export function escape(value){
  const chars={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(value??'').replace(/[&<>"']/g,c=>chars[c]);
}
export const fmt=value=>new Intl.NumberFormat('pt-BR').format(value);
export const keyNames={official:'Gabarito oficial',preliminary:'Gabarito preliminar',proposed:'Resolução de estudo',annulled:'Questão anulada',pending:'Chave não confirmada'};
export function urlFor(value){
  if(typeof value!=='string') return '';
  if(value.startsWith('media/') && !value.split('/').includes('..'))return root+value.split('/').map(encodeURIComponent).join('/');
  try{const parsed=new URL(value);if(['http:','https:'].includes(parsed.protocol))return parsed.href;}catch{}
  return '';
}
export function link(value,label,page){
  let href=urlFor(value);if(!href)return '';
  if(Number(page)>0)href=href.split('#')[0]+'#page='+Number(page);
  return `<a href="${escape(href)}" target="_blank" rel="noreferrer">${escape(label)} <span aria-hidden="true">↗</span></a>`;
}
export function option(value,label,current){
  return `<option value="${escape(value)}"${String(value)===String(current??'')?' selected':''}>${escape(label)}</option>`;
}
export function errorMessage(message){
  const bar=$('#app-error');bar.textContent=message||'';bar.hidden=!message;
}
export async function api(path,body,{guest=false,profileId=null,signal}={}){
  const settings={credentials:guest?'omit':'same-origin',cache:'no-store',headers:{},signal};
  if(profileId)settings.headers['X-Study-Profile']=profileId;
  if(body!==undefined){
    settings.method='POST';
    settings.headers['Content-Type']='application/json';
    settings.body=JSON.stringify(body);
  }
  const apiPath=guest?path+(path.includes('?')?'&':'?')+'guest=1':path;
  let response;
  try{response=await fetch(root+'api/'+apiPath,settings);}catch(error){
    if(signal?.aborted)throw error;
    throw new Error('O caderno perdeu a conexão. Confira a conexão e tente novamente.');
  }
  const data=await response.json().catch(error=>{if(signal?.aborted)throw error;return null;});
  if(!response.ok){
    const error=new Error(data?.error||'Não foi possível concluir a ação.');
    error.status=response.status;
    throw error;
  }
  if(!data)throw new Error('O caderno recebeu uma resposta inválida. Tente novamente.');
  return data;
}
export const byText=(a,b)=>String(a).localeCompare(String(b),'pt-BR',{sensitivity:'base',numeric:true});
export function examLabel(exam) {
  const prefix = exam.institute + ' ' + exam.year + ' · ';
  const title = exam.title.startsWith(prefix) ? exam.institute + ' · ' + exam.title.slice(prefix.length) : exam.title;
  return exam.year + ' · ' + title;
}
export const fold=text=>String(text??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export const displayDate=iso=>{
  if(typeof iso!=='string')return '';
  const m=iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T|$)/);
  return m?m[3]+'/'+m[2]+'/'+m[1]:iso;
};

