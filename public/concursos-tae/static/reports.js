import { $, escape as h, errorMessage, examLabel, fmt, option, link, byText, fold, displayDate } from './dom.js';
import { isSpecificSubject, subjectPractice, topicPractice } from './programas.js';

const pct=(n,d)=>d?Math.round(100*n/d)+'%':'—';
const resultName={correct:'Acerto',wrong:'Erro',neutral:'Sem pontuação'};
const dates=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'});
function metric(value,label){return `<div class="metric"><strong>${h(value)}</strong><span>${h(label)}</span></div>`;}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(i=>'<th scope="col">'+h(i)+'</th>').join('')}</tr></thead><tbody>${rows.map(row=>'<tr>'+row.map(v=>'<td>'+h(v)+'</td>').join('')+'</tr>').join('')}</tbody></table></div>`;}
function summaryTable(items){
  return items.length?table(['Área','Questões','Acertos'],items.map(v=>[v.name,fmt(v.correct+v.wrong+v.neutral),pct(v.correct,v.correct+v.wrong)])):'<p class="subtext">O resumo aparece depois da primeira resposta.</p>';
}
function chart(canvas,days){
  if(!canvas||!days.length)return;
  const rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);
  if(!rect.width)return;
  const width=Math.max(240,rect.width),height=134;
  canvas.width=width*ratio;canvas.height=height*ratio;
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  const vars=getComputedStyle(document.documentElement),dark=document.documentElement.dataset.theme==='dark';
  const colors=[dark?'#abdcc4':'#307d65',dark?'#e9ac91':'#b55e46',dark?'#92a9b0':'#72868d'];
  const max=Math.max(1,...days.map(d=>d.correct+d.wrong+d.neutral));const baseline=height-15,barArea=height-30;
  ctx.strokeStyle=vars.getPropertyValue('--line');ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,baseline+.5);ctx.lineTo(width,baseline+.5);ctx.stroke();
  const slot=width/days.length;
  days.forEach((day,i)=>{let bottom=baseline;[day.correct,day.wrong,day.neutral].forEach((value,k)=>{if(!value)return;const bh=value/max*barArea;ctx.fillStyle=colors[k];ctx.fillRect(i*slot+slot*.16,bottom-bh,slot*.68,bh);bottom-=bh;});});
}
let redraw=()=>{};
window.addEventListener('resize',()=>redraw());
window.addEventListener('tae-theme',()=>redraw());
function historyRow(r){
  return `<li><div><strong>${h(r.institute)} · ${h(r.role)}</strong><br><small>${h(r.year)} · Questão ${h(r.number)} · ${h(r.subject)} · ${h(dates.format(new Date(r.when*1000)))}</small><br><span class="result-${h(r.result)}">${h(resultName[r.result])}</span> · alternativa ${h(r.choice)}</div><button class="quiet small" data-review="${h(r.question)}" type="button">Rever</button></li>`;
}
function medalsPanel(progress) {
  const { level, xp, levelFloor, nextLevelXp, unique, mastered, studyDays, milestones, rules } = progress;
  const earned = milestones.filter(target => unique >= target).length;
  const next = milestones[earned];
  const questionCount = count => fmt(count) + (count === 1 ? ' questão' : ' questões');
  const badge = (target, index) => {
    const unlocked = index < earned;
    const status = unlocked ? 'Desbloqueada' : target === next ? 'Próxima meta' : 'A conquistar';
    return `<li class="medal${unlocked ? ' earned' : ''}"><span class="medal-seal" aria-hidden="true">${unlocked ? '✓' : '◇'}</span><span><strong>${questionCount(target)}</strong><small>${status}</small></span></li>`;
  };
  return `<section class="panel progress-panel" aria-labelledby="progress-title">
    <h2 id="progress-title">Pontos e conquistas</h2>
    <div class="progress-columns">
      <div><h3>Nível ${fmt(level)}</h3><p class="progress-value">${fmt(xp)} <span>XP</span></p>
        <progress value="${xp - levelFloor}" max="${nextLevelXp - levelFloor}" aria-label="Progresso até o nível ${level + 1}"></progress>
        <p class="subtext">Mais ${fmt(nextLevelXp - xp)} XP para chegar ao nível ${fmt(level + 1)}.</p></div>
      <div><h3>${next ? 'Próxima medalha' : 'Coleção completa'}</h3>
        <p class="progress-value">${next ? questionCount(next) : fmt(earned) + ' medalhas'}</p>
        <progress value="${next ? unique : earned}" max="${next || milestones.length}" aria-label="Progresso das medalhas por questões resolvidas"></progress>
        <p class="subtext">${next ? fmt(unique) + ' de ' + questionCount(next) + (next === 1 ? ' resolvida.' : ' resolvidas.') : 'Você conquistou todas as medalhas por questões resolvidas.'}</p></div>
    </div>
    <p class="points-rules">Cada questão vale <strong>${rules.unique} XP</strong> na primeira resposta, inclusive as anuladas ou pendentes. O primeiro acerto de cada questão rende mais <strong>${rules.correct} XP</strong>. Cada dia de estudo com resposta vale <strong>${rules.day} XP</strong>, pelo horário de Brasília.</p>
    <p class="progress-totals">${questionCount(unique)} · ${fmt(mastered)} com acerto · ${fmt(studyDays)} ${studyDays === 1 ? 'dia de estudo' : 'dias de estudo'}</p>
    <details class="medal-collection"><summary>Medalhas desbloqueadas · ${fmt(earned)} de ${fmt(milestones.length)}</summary><ul class="medal-list">${milestones.map(badge).join('')}</ul></details>
  </section>`;
}
export async function showPerformance(node,openQuestion,current,read,onProgress){
  const data=await read('performance');if(!current())return;
  onProgress?.(data.progress);
  const attempts=data.days.reduce((n,r)=>n+r.correct+r.wrong+r.neutral,0);
  node.innerHTML=`<h2>Meu desempenho</h2><div class="metrics">${metric(fmt(data.unique),'Questões respondidas')}${metric(pct(data.correct,data.graded),'Acerto na última resposta')}${metric(fmt(data.wrong),'Questões para revisar')}${metric(fmt(data.attempts),'Tentativas registradas')}</div>
    ${medalsPanel(data.progress)}
    <div class="dash-grid"><section class="panel"><h2>Últimos 14 dias</h2>${attempts?'':'<p class="subtext">Ao responder, você verá sua atividade por dia aqui.</p>'}<canvas id="trend-canvas" role="img" aria-label="Tentativas por dia. Os valores estão na tabela abaixo."></canvas><div class="chart-dates"><span>${h(displayDate(data.days[0].day))}</span><span>${h(displayDate(data.days.at(-1).day))}</span></div><p class="chart-legend"><span>Acertos</span><span>Erros</span><span>Sem pontuação</span></p>
    <details><summary>Ver números por dia</summary>${table(['Data','Acertos','Erros','Sem pontuação'],data.days.map(d=>[displayDate(d.day),d.correct,d.wrong,d.neutral]))}</details></section>
    <section class="panel"><h2>Por instituto</h2>${summaryTable(data.institutes)}<p class="subtext">O percentual usa a última resposta a cada questão com correção. Anuladas e questões sem chave ficam fora do cálculo.</p></section></div>
    <section class="panel"><h2>Por disciplina</h2>${summaryTable(data.subjects)}<details><summary>Consultar desempenho por cargo</summary>${summaryTable(data.roles)}</details></section>
    <section class="panel"><h2>Histórico de respostas</h2>${data.recent.length?'':'<p class="subtext">Suas tentativas aparecerão aqui em ordem de data.</p>'}<ol class="history" id="attempts-list">${data.recent.map(historyRow).join('')}</ol><button id="more-history" type="button" class="quiet"${data.hasMore?'':' hidden'}>Carregar mais</button></section>`;
  const canvas=$('#trend-canvas');redraw=()=>{if(canvas.isConnected&&!node.hidden)chart(canvas,data.days);};redraw();
  node.onclick=event=>{const btn=event.target.closest('[data-review]');if(btn)openQuestion(btn.dataset.review);};
  let offset=data.recent.length;
  $('#more-history').onclick=async event=>{
    const btn=event.currentTarget;btn.disabled=true;
    try{const next=await read('performance?offset='+offset);if(!current())return;$('#attempts-list').insertAdjacentHTML('beforeend',next.recent.map(historyRow).join(''));offset+=next.recent.length;btn.hidden=!next.hasMore;}
    catch(e){if(current())errorMessage(e.message);}finally{btn.disabled=false;}
  };
}
function subjectName(s){return typeof s==='string'?s:s?.name||'';}
function sourceLinks(n){
  const seen=new Set(),items=[];
  for(const [v,label] of [[n.pdf,'Edital em PDF'],[n.url,'Edital na fonte'],[n.syllabusPdf,'Programa em PDF'],[n.syllabusUrl||n.programUrl,'Conteúdo programático'],[n.extensionUrl,'Prorrogação'],[n.sourceIndexUrl,'Página do concurso']]){
    if(v&&!seen.has(v)){seen.add(v);items.push(link(v,label));}
  }
  return items.join('');
}
function textValue(v){
  if(typeof v==='string'||typeof v==='number')return String(v);
  if(Array.isArray(v))return v.map(textValue).filter(Boolean).join(' · ');
  if(v&&typeof v==='object')return Object.entries(v).filter(([k,val])=>!/(url|sha|pdf|path|id$)/i.test(k)&&(typeof val==='string'||typeof val==='number')).map(([,val])=>val).join(' · ');
  return '';
}
function noticeStatus(n){
  if(!n.inscriptionsStart||!n.inscriptionsEnd)return n.statusLabel||textValue(n.status);
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(today<n.inscriptionsStart)return 'Edital publicado · inscrições previstas';
  return today<=n.inscriptionsEnd?'Período de inscrições previsto no edital':'Período de inscrições encerrado pelo cronograma do edital';
}
export function showNotices(node,catalog,study,noticeId){
  const institutes=[...new Set([...catalog.notices.map(n=>n.institute),...catalog.exams.map(e=>e.institute)])].sort(byText);
  const studyIndex=catalog.studyIndex||{};
  const requested=catalog.notices.find(n=>n.id===noticeId);
  let institute=requested?.institute||(institutes.includes('IFFar')?'IFFar':institutes[0]),role='',edition=requested?.id||'recent';
  const links=new Map();
  function practiceButton(filters,label){
    const id=String(links.size);
    links.set(id,filters);
    return '<button class="link-button" data-subject="'+id+'" type="button">'+h(label)+'</button>';
  }
  function renderSubject(s,n,current){
    const name=subjectName(s);
    const topics=typeof s==='object'?(s.topics||[]):[];
    const practices=subjectPractice(studyIndex,n.institute,current.studyRole||current.name,name);
    const specific=isSpecificSubject(name);
    const program=textValue(s.program);
    const subjectButtons=practices.map(({filters,combined})=>{
      if(combined)return practiceButton(filters,'Estudar o bloco histórico de Legislação e EPT '+(filters.role?'neste cargo':'no '+filters.institute));
      if(filters.institute!==n.institute)return practiceButton(filters,'Estudar o mesmo cargo no '+filters.institute);
      const label=filters.role?'Estudar esta disciplina no cargo':'Estudar esta disciplina no instituto';
      return practiceButton(filters,label);
    }).join('');
    const topicItems=topics.map(t=>{
      const text=textValue(t);
      const buttons=topicPractice(practices,text).map(filters=>{
        const scope=filters.institute!==n.institute?' · '+filters.institute:filters.role?'':' · todos os cargos de '+n.institute;
        return practiceButton(filters,'Praticar '+filters.topic+scope);
      }).join('');
      return '<li>'+h(text)+(buttons?'<div class="source-links">'+buttons+'</div>':'')+'</li>';
    }).join('');
    const source=link(n.pdf||n.pdfUrl,'Ver este componente no edital',s.sourcePages?.[0]);
    const count=s.count||s.questions;
    const empty=specific?'Ainda não há questões desta disciplina para este cargo no acervo.':'Ainda não há questões classificadas nesta disciplina para este instituto.';
    return '<details><summary>'+h(name)+(count?' · '+h(count)+' questões':'')+'</summary>'
      +(s.minCorrect?'<p class="subtext">Mínimo previsto de '+h(s.minCorrect)+' acertos neste componente.</p>':'')
      +(s.countSource?'<p class="subtext">'+h(s.countSource)+'.</p>':'')
      +(source&&s.sourcePages?.length?'<div class="source-links">'+source+'</div>':'')
      +(program?(topics.length?'<details><summary>Texto integral do programa</summary><p>'+h(program)+'</p></details>':'<p>'+h(program)+'</p>'):'')
      +(topicItems?'<ul>'+topicItems+'</ul>':'')
      +(subjectButtons?'<div class="source-links">'+subjectButtons+'</div>':'<p class="subtext">'+h(empty)+'</p>')
      +'</details>';
  }
  function render(){
    links.clear();
    const yearOf=n=>Number((String(n.number).match(/(?:19|20)\d{2}/g)||[]).at(-1)||String(n.date||'').slice(0,4))||0;
    const available=catalog.notices.filter(n=>n.institute===institute).sort((a,b)=>yearOf(b)-yearOf(a)||String(b.date).localeCompare(String(a.date)));
    const recentYear=available.length?yearOf(available[0]):null;
    const notices=available.filter(n=>edition==='recent'?yearOf(n)===recentYear:n.id===edition);
    const exams=catalog.exams.filter(e=>e.institute===institute).sort((a,b)=>b.year-a.year||byText(a.role,b.role));
    const roles=[...new Set(notices.flatMap(n=>(n.roles||[]).map(r=>r.name)))].sort(byText);
    if(!roles.includes(role))role=roles.find(r=>fold(r)==='assistente em administracao')||roles[0]||'';
    const coverage=catalog.coverage.filter(c=>c.institute===institute).flatMap(c=>c.entries||[]);
    const makeNotice=n=>{
      const current=(n.roles||[]).find(r=>r.name===role);
      const course=current?.subjects||[];
      const status=noticeStatus(n);
      return `<article class="notice-card"><p class="eyebrow">${h(n.institute)} · ${h(displayDate(n.date||n.publishedDate||''))}</p><h2>Edital ${h(n.number)} · ${h(n.title)}</h2><p class="notice-meta">${h(status)}</p>
        ${n.inscriptionsStart&&n.inscriptionsEnd?'<p>Inscrições de '+h(displayDate(n.inscriptionsStart))+' a '+h(displayDate(n.inscriptionsEnd))+'.</p>':''}
        ${n.examDate?'<p>Prova '+(n.examDateStatus==='prevista'?'prevista ':'')+'em '+h(displayDate(n.examDate))+'.</p>':''}
        ${n.detail?'<p class="subtext">'+h(textValue(n.detail))+'</p>':''}
        ${n.extension?'<p class="subtext">'+h(textValue(n.extension))+(n.validAreas?' · '+h(n.validAreas):'')+'</p>':''}
        <div class="source-links">${sourceLinks(n)}</div>
        ${current?`<h3 class="notice-role">Conteúdos de ${h(role)}</h3>${course.map(s=>renderSubject(s,n,current)).join('')}`:'<p class="subtext">O cargo selecionado pertence a outro edital deste instituto.</p>'}</article>`;
    };
    node.innerHTML=`<h2>Editais e fontes</h2><div class="notice-controls"><label for="notice-institute">Instituto<select id="notice-institute">${institutes.map(v=>option(v,v,institute)).join('')}</select></label>
      <label for="notice-edition">Edital de referência<select id="notice-edition">${option('recent','Mais recentes'+(recentYear?' · '+recentYear:''),edition)}${available.map(n=>option(n.id,n.number+' · '+n.title,edition)).join('')}</select></label>
      <label for="notice-role">Cargo do edital<select id="notice-role"${roles.length?'':' disabled'}>${roles.map(v=>option(v,v,role)).join('')}</select></label></div>
      ${notices.filter(n=>!role||(n.roles||[]).some(r=>r.name===role)).map(makeNotice).join('')||'<article class="notice-card"><p>Consulte as fontes históricas deste instituto abaixo.</p></article>'}
      <section class="panel"><h2>Provas no acervo</h2><p class="subtext">${fmt(exams.length)} cadernos de ${h(institute)}. O ano indica quando a prova foi aplicada. Uma questão comum a cargos diferentes conserva sua posição em cada caderno.</p>
      <details><summary>Consultar as provas e os gabaritos</summary><ul class="coverage-list">${exams.map(e=>`<li><strong>${h(examLabel(e))}</strong> · ${h(e.board)} · ${fmt(e.count)} questões <div class="source-links">${link(e.pdf||e.sourceUrl,'Prova')}${link(e.keyPdf||e.keyUrl,'Gabarito',e.keyPage)}${link(e.correctionPdf||e.keyCorrectionUrl,'Retificação')}${e.pdf?link(e.sourceUrl,'Origem do caderno'):''}<button class="link-button" type="button" data-exam="${h(e.id)}">Estudar esta prova</button></div></li>`).join('')}</ul></details>
      ${coverage.length?'<details><summary>Cobertura e lacunas</summary><ul class="coverage-list">'+coverage.map(v=>'<li>'+h(textValue(v))+'</li>').join('')+'</ul></details>':''}</section>`;
    $('#notice-institute').onchange=event=>{institute=event.target.value;role='';edition='recent';render();$('#notice-institute').focus();};
    $('#notice-edition').onchange=event=>{edition=event.target.value;role='';render();$('#notice-edition').focus();};
    $('#notice-role').onchange=event=>{role=event.target.value;render();$('#notice-role').focus();};
    node.onclick=event=>{const s=event.target.closest('[data-subject]'),e=event.target.closest('[data-exam]');if(s&&links.has(s.dataset.subject))study(links.get(s.dataset.subject));if(e)study({institute,exam:e.dataset.exam});};
  }
  render();
}

