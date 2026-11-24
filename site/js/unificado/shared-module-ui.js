/** Fase 8B: aula e diagnóstico nativos com registro seguro e pedagógico por disciplina.
 * Administração usa a fonte F7C ou ADM-ESTUDO apenas para LEITURA.
 */
import {loadSharedModule} from './shared-module-loader.js';
import {getSubject} from './subjects.js';
import {readSharedBaseline,buildSharedStudyView} from './shared-activity-bridge.js';
import {saveSharedActivity} from './shared-activity-store.js';
import {ratingText} from './shared-progress.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
const text=x=>esc(x).replace(/\n/g,'\n');
const nav=(id,mod)=>`#estudo/${encodeURIComponent(id)}/${encodeURIComponent(mod)}`;
const ratingChoices=(kind,topicId,active,disabled)=>`<div class="shared-rating-actions" role="group" aria-label="${kind==='diagnostic'?'Diagnóstico':'Autoavaliação da aula'}">
 ${[['sei','Eu sei'],['duvida','Tenho dúvida'],['nao','Não sei']].map(([value,label])=>
  `<button class="btn ${active===value?'shared-selected':''}" type="button" data-shared-action="${kind}" data-shared-topic="${esc(topicId)}" data-shared-rating="${value}"
  aria-pressed="${active===value}" ${disabled?'disabled':''}>${label}</button>`).join('')}
 </div>`;
const origin=x=>x==='novo'?'Registrado no motor novo':x==='herdado'?'Herdado do histórico anterior':'Ainda não registrado';
function lessonView(bundle,i,view){
 const topics=bundle.subtopics.filter(x=>bundle.lessons[x.id]);
 if(!Number.isSafeInteger(i)||i<1||i>topics.length)throw Error('Página da aula inválida.');
 const t=topics[i-1],l=bundle.lessons[t.id],base=nav(bundle.subjectId,bundle.moduleId);
 const entry=view.score?.subtopics[t.id],disabled=view.locked||bundle.subjectId!=='administracao';
 const fields=[['Objetivo da aula',l.objective],['Entenda o conceito',l.concept],['Explicação',l.explanation],
   ['Exemplo na prática',l.example],['Como aparece em concursos',l.examTip],['Resumo para revisar',l.summary]];
 return `<article class="activity-card"><p class="eyebrow">Aula ${i} de ${topics.length} · ${esc(t.id)}</p><h2>${esc(t.title)}</h2>
 ${fields.filter(([,v])=>typeof v==='string'&&v.trim()).map(([h,v])=>`<section><h3>${esc(h)}</h3><p class="native-paragraph">${text(v)}</p></section>`).join('')}
 ${l.reviewQuestion?`<details class="preview-answer"><summary>Recuperação ativa: ${esc(l.reviewQuestion)}</summary><p class="native-paragraph">${text(l.reviewAnswer)}</p></details>`:''}
 <section class="shared-study-record"><h3>Conclusão e autoavaliação</h3>
 <p class="small muted">${entry?.completed?'Aula já marcada como estudada.':'Marque a aula depois de ler e revisar o conteúdo.'} ${entry?.lessonOrigin==='herdado'?'A conclusão anterior está preservada.':''}</p>
 <div class="inline-actions">${entry?.completed?'<span class="state live">✓ Aula concluída</span>':
 `<button class="btn btn-primary" type="button" data-shared-action="lesson-complete" data-shared-topic="${esc(t.id)}" ${disabled?'disabled':''}>Marcar aula como estudada</button>`}</div>
 <p>Como você avalia sua compreensão desta aula? A resposta pode ser atualizada.</p>
 ${ratingChoices('lesson-rating',t.id,entry?.lessonRating,disabled)}
 <p class="small muted">${origin(entry?.lessonOrigin??'nenhum')}${entry?.lessonRating?` · ${ratingText(entry.lessonRating)}`:''}</p></section>
 </article><nav class="preview-pagination" aria-label="Navegação pelas aulas">
 ${i>1?`<a class="btn" href="${base}/aula/${i-1}">← Aula anterior</a>`:''}
 <span>${i} / ${topics.length}</span>
 ${i<topics.length?`<a class="btn btn-primary" href="${base}/aula/${i+1}">Próxima aula →</a>`:''}</nav>`;
}
function diagnosticView(bundle,i,view){
 const cards=bundle.diagnostic;
 if(!Number.isSafeInteger(i)||i<1||i>cards.length)throw Error('Cartão diagnóstico inválido.');
 const q=cards[i-1],base=nav(bundle.subjectId,bundle.moduleId),entry=view.score?.subtopics[q.subtopicId];
 return `<article class="activity-card"><p class="eyebrow">Diagnóstico ${i} de ${cards.length}</p>
 <h2>${esc(bundle.subtopics.find(x=>x.id===q.subtopicId)?.title??q.subtopicId)}</h2>
 <p class="native-paragraph">${text(q.front)}</p>
 <details class="preview-answer"><summary>Revelar resposta</summary><p class="native-paragraph">${text(q.back)}</p>
 <h3>Como você avalia seu conhecimento?</h3>
 ${ratingChoices('diagnostic',q.subtopicId,entry?.diagnostic,view.locked||bundle.subjectId!=='administracao')}
 </details><p class="small muted">${origin(entry?.diagnosticOrigin??'nenhum')}${entry?.diagnostic?` · ${ratingText(entry.diagnostic)}`:''}</p></article>
 <nav class="preview-pagination" aria-label="Navegação do diagnóstico">${i>1?`<a class="btn" href="${base}/diagnostico/${i-1}">← Anterior</a>`:''}<span>${i} / ${cards.length}</span>
 ${i<cards.length?`<a class="btn btn-primary" href="${base}/diagnostico/${i+1}">Próximo →</a>`:''}</nav>`;
}
function indexView(bundle,view){
 const base=nav(bundle.subjectId,bundle.moduleId);
 return `<section class="panel"><h2>Conteúdos do módulo</h2><p>Aulas e diagnósticos por subtópico, carregados sob demanda.</p>
 <div class="module-list">${bundle.subtopics.map((t,i)=>{
  const e=view.score?.subtopics[t.id];
  const li=bundle.subtopics.filter(x=>bundle.lessons[x.id]).findIndex(x=>x.id===t.id)+1;
  const di=bundle.diagnostic.findIndex(x=>x.subtopicId===t.id)+1;
  return `<div class="module-item"><strong>${i+1}. ${esc(t.title)}</strong>
  <small>${e?.completed?'Aula concluída · ':''}${e?.diagnostic?`Diagnóstico: ${ratingText(e.diagnostic)} · `:''}${origin(e?.lessonOrigin??'nenhum')}</small>
  <div class="inline-actions">${bundle.lessons[t.id]?`<a class="btn" href="${base}/aula/${li}">Ler aula</a>`:''}
  ${bundle.diagnostic.some(c=>c.subtopicId===t.id)?`<a class="btn" href="${base}/diagnostico/${di}">Diagnóstico</a>`:''}</div></div>`;}).join('')}</div></section>`;
}
function progressNotice(view,subjectId){
 if(subjectId!=='administracao')return '<p class="notice">Aulas e diagnósticos desta disciplina continuam <strong>somente leitura</strong> no motor compartilhado. A gravação será ativada quando o adaptador de progresso específico estiver validado.</p>';
 if(view.locked)return `<p class="notice error" role="alert"><strong>Atualização suspensa:</strong> ${esc(view.reason)} <a href="#treino-admin/auditoria">Exportar backup na auditoria</a>.</p>`;
 const x=view.score;
 const points=x.hasData?`${x.earnedWeightedPoints.toFixed(2).replace('.',',')} de 100 pontos`:'Sem nota registrada';
 const source=view.source==='imported'?'cópia da Fase 7C':view.source==='legacy'?'ADM-ESTUDO original (somente leitura)':'nenhuma fonte anterior';
 const revised=x.sourceChanged?' · com atualizações feitas neste motor':' · sem alterações no motor compartilhado';
 return `<section class="panel shared-achievement"><h2>Aproveitamento do módulo</h2>
 <strong>${esc(points)}</strong> <span class="state ${x.completed?'live':''}">${x.completed?'Meta de 75 atingida':'Meta: 75 pontos'}</span>
 <p class="small muted">Base: ${esc(source)}${revised}. Cada diagnóstico ou aula aparece uma única vez, sem duplicação. As etapas de exercícios (até 30 pontos) e Banco (até 20 pontos) permanecem herdadas, sem novas contribuições, até a Fase 8C.</p>
 <p class="small muted">Diagnósticos: ${x.evidence.diagnostics}/${x.evidence.diagnosticsTotal} · Aulas concluídas: ${x.evidence.lessonsDone}/${x.evidence.lessonsTotal} · Autoavaliações: ${x.evidence.lessonsRated}/${x.evidence.lessonsTotal}</p>
 <a class="btn" href="#treino-admin/auditoria">Exportar backup completo antes de avançar</a></section>`;
}
export async function renderSharedModule(route,main,isCurrent=()=>true,loader=loadSharedModule,viewLoader=buildSharedStudyView){
 if(route[0]!=='estudo'||route.length<3||route.length>5)throw Error('Rota de estudo inválida.');
 const [,subjectId,moduleId,screen='inicio',index='1']=route;
 const subject=getSubject(subjectId);if(!subject)throw Error('Disciplina desconhecida.');
 const bundle=await loader(subjectId,moduleId);
 if(!isCurrent())return;
 const view=await viewLoader(bundle);
 if(!isCurrent())return;
 const base=nav(subjectId,moduleId);
 const content=screen==='inicio'&&route.length===3?indexView(bundle,view):
   screen==='aula'&&route.length===5?lessonView(bundle,Number(index),view):
   screen==='diagnostico'&&route.length===5?diagnosticView(bundle,Number(index),view):null;
 if(content===null)throw Error('Página do módulo inválida.');
 const actions=subjectId==='administracao'
   ?`<a class="btn" href="#treino-admin/modulo/${esc(moduleId)}">Histórico herdado</a><a class="btn btn-primary" href="#treino-admin/banco/${esc(moduleId)}/1">Responder questões</a>`
   :`<a class="btn" href="#materia/${esc(subjectId)}">Voltar à disciplina</a>`;
 const targetMain=main;
 if(isCurrent())targetMain.innerHTML=`<div class="section-head"><div><p class="eyebrow">Motor compartilhado · Fase 8B</p><h1>${esc(bundle.moduleId)} — ${esc(bundle.title)}</h1></div>
 <a class="btn" href="${base}">← Índice do módulo</a></div>
 <div class="inline-actions">${actions}</div>${progressNotice(view,subjectId)}${content}`;
}
let busy=false;
/** Recebe somente botões da rota de estudo e valida página + subtópico no bundle. */
export async function handleSharedModuleClick(event,rerender,{
 loader=loadSharedModule,storage=globalThis.localStorage,baselineReader=readSharedBaseline,viewLoader=buildSharedStudyView
}={}){
 const btn=event.target?.closest?.('button[data-shared-action]');if(!btn)return false;
 if(busy)return true;busy=true;btn.disabled=true;
 try{
  const hash=globalThis.location?.hash??'';
  const route=decodeURIComponent(hash.slice(1)).split('/');
  const [,subjectId,moduleId,screen,index]=route;
  if(route[0]!=='estudo'||!getSubject(subjectId)||route.length!==5)throw Error('Abra uma aula ou diagnóstico para registrar a atividade.');
  if(subjectId!=='administracao')throw Error('A gravação desta disciplina ainda não foi ativada no motor compartilhado.');
  const bundle=await loader(subjectId,moduleId);
  if((globalThis.location?.hash??'')!==hash)throw Error('Você mudou de módulo durante a gravação. Resposta não salva.');
  const kind=btn.dataset.sharedAction,topicId=btn.dataset.sharedTopic,rating=btn.dataset.sharedRating;
  if(!Number.isSafeInteger(Number(index))||Number(index)<1)throw Error('Página inválida.');
  const expected=screen==='aula'?bundle.subtopics.filter(t=>bundle.lessons[t.id])[Number(index)-1]?.id:
    screen==='diagnostico'?bundle.diagnostic[Number(index)-1]?.subtopicId:null;
  if(expected!==topicId||!
    (screen==='aula'?['lesson-complete','lesson-rating'].includes(kind):kind==='diagnostic'))
    throw Error('Esta resposta não corresponde à atividade aberta.');
  // Valida a integridade da cópia pedagógica e o catálogo antes da primeira
  // escrita: a UI nunca tenta salvar sobre uma fonte invalidada.
  const current=await viewLoader(bundle,{storage});
  if(current.locked)throw Error(current.reason);
  if((globalThis.location?.hash??'')!==hash)throw Error('A página mudou durante a verificação. Resposta não salva.');
  const result=await saveSharedActivity(subjectId,bundle,{kind,topicId,rating},{storage,baselineReader});
  if(!result.ok)throw Error(result.message);
  await rerender();return true;
 }catch(e){if(typeof globalThis.alert==='function')globalThis.alert('Atividade não registrada: '+e.message);return true;}
 finally{busy=false;btn.disabled=false;}
}
