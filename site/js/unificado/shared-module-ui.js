/** Fase 8B: aula e diagnóstico nativos com registro seguro e pedagógico por disciplina.
 * Administração usa a fonte F7C ou ADM-ESTUDO apenas para LEITURA.
 */
import {loadSharedModule} from './shared-module-loader.js';
import {getSubject} from './subjects.js';
import {readSharedBaseline,buildSharedStudyView} from './shared-activity-bridge.js';
import {saveSharedActivity} from './shared-activity-store.js';
import {ratingText} from './shared-progress.js';
import {renderSharedExercises,handleSharedExerciseClick} from './shared-exercise-ui.js';
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
/** Layout de módulo inspirado na organização do ADM-ESTUDO original.
 * O diagnóstico é uma etapa do MÓDULO; as aulas são links por subtópico.
 * Não mexe em registros, notas, catálogo ou rotas internas.
 */
function indexView(bundle,view){
 const base=nav(bundle.subjectId,bundle.moduleId);
 const subjectId=bundle.subjectId;
 const validRatings=new Set(['sei','duvida','nao']);
 const answered=bundle.diagnostic.filter(c=>validRatings.has(view.score?.subtopics?.[c.subtopicId]?.diagnostic)).length;
 const nextCard=bundle.diagnostic.findIndex(c=>!validRatings.has(view.score?.subtopics?.[c.subtopicId]?.diagnostic));
 const diagnosticPage=nextCard<0?1:nextCard+1;
 const lessons=bundle.subtopics.filter(t=>bundle.lessons[t.id]);
 const studied=lessons.filter(t=>view.score?.subtopics?.[t.id]?.completed===true).length;
 const exercise=view.score?.liveExercise;
 const bank=view.score?.liveBank;
 const primary=subjectId==='administracao'
  ? `<div class="shared-module-primary-actions">
     ${bundle.diagnostic.length?`<a class="shared-module-action" href="${base}/diagnostico/${diagnosticPage}"><strong>Diagnóstico</strong><small>${answered}/${bundle.diagnostic.length} cartões avaliados · ${answered===bundle.diagnostic.length?'Rever respostas':'Continuar avaliação'}</small></a>`:''}
     <a class="shared-module-action" href="${base}/exercicios"><strong>Exercícios de aprendizagem</strong><small>${exercise?`${exercise.answered}/${exercise.total} respondidos`:'Praticar o que aprendi'}</small></a>
     <a class="shared-module-action" href="#treino-admin/banco/${esc(bundle.moduleId)}/1"><strong>Banco de questões</strong><small>${bank?`${bank.answered} questões respondidas no treino`:'Praticar questões do módulo'}</small></a>
     </div>`
  : `<div class="shared-module-primary-actions">
     ${bundle.diagnostic.length?`<a class="shared-module-action" href="${base}/diagnostico/${diagnosticPage}"><strong>Diagnóstico</strong><small>${answered}/${bundle.diagnostic.length} cartões avaliados</small></a>`:''}
     <span class="shared-module-action shared-module-disabled"><strong>Exercícios de aprendizagem</strong><small>Em preparação nesta disciplina</small></span>
     <span class="shared-module-action shared-module-disabled"><strong>Banco de questões</strong><small>Em preparação nesta disciplina</small></span>
     </div>`;
 const topicRows=bundle.subtopics.map((t,i)=>{
  const lessonIndex=lessons.findIndex(x=>x.id===t.id)+1;
  const entry=view.score?.subtopics?.[t.id];
  const status=entry?.completed?'✓ Aula concluída':entry?.lessonRating?'Autoavaliação registrada':'Aula pendente';
  if(!lessonIndex)return `<li class="shared-topic-unavailable"><span>${i+1}. ${esc(t.title)}</span><small>Aula em preparação</small></li>`;
  return `<li><a class="shared-topic-link" href="${base}/aula/${lessonIndex}" aria-label="Abrir aula: ${esc(t.title)}">
   <span class="shared-topic-main"><span class="shared-topic-number">${i+1}.</span><span><strong>${esc(t.title)}</strong><small>${status}</small></span></span>
   <span class="shared-topic-arrow" aria-hidden="true">›</span></a></li>`;
 }).join('');
 const tools=subjectId==='administracao'?`<details class="shared-module-extra"><summary>Outras ferramentas e informações</summary>
  <nav class="inline-actions" aria-label="Ferramentas complementares do módulo">
  <a class="btn" href="#treino-admin/revisao">Revisão</a><a class="btn" href="#treino-admin/simulado">Simulados</a>
  <a class="btn" href="#treino-admin/estatisticas">Estatísticas</a><a class="btn" href="#treino-admin/modulo/${esc(bundle.moduleId)}">Histórico anterior</a>
  <a class="btn" href="#materia/administracao/legado">Abrir ADM-ESTUDO original</a></nav>
  <p class="small muted">Módulo ${esc(bundle.moduleId)} · ${bundle.subtopics.length} subtópicos · ${bundle.questionCount??0} questões no catálogo.</p>
  </details>`:'';
 return `<section class="panel shared-module-stages"><h2>Atividades do módulo</h2>
 <p class="muted">O diagnóstico avalia o módulo inteiro. Exercícios e Banco de Questões também ficam aqui, sem repetição nos subtópicos.</p>
 ${primary}</section>
 <section class="panel shared-module-lessons"><h2>Aulas por subtópico</h2>
 <p class="muted">${studied}/${lessons.length} aulas concluídas · Selecione o assunto para abrir a aula.</p>
 <ol class="shared-topic-list">${topicRows}</ol></section>
 ${tools}`;
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
 <p class="small muted">Base: ${esc(source)}${revised}. Cada diagnóstico ou aula aparece uma única vez, sem duplicação. Exercícios novos substituem a etapa Exercícios na nota. O Banco pode conciliar respostas antigas e novas por ID quando há evidência e datas verificáveis; caso contrário, a pontuação herdada fica congelada, sem duplicação.</p>
 <p class="small muted">Diagnósticos: ${x.evidence.diagnostics}/${x.evidence.diagnosticsTotal} · Aulas concluídas: ${x.evidence.lessonsDone}/${x.evidence.lessonsTotal} · Autoavaliações: ${x.evidence.lessonsRated}/${x.evidence.lessonsTotal}</p>
 ${x.liveExercise?`<p class="small muted">Exercícios atuais: ${x.liveExercise.answered}/${x.liveExercise.total} respondidos · ${x.liveExercise.correct} acertos.</p>`:''}
 ${x.liveBank?`<p class="small muted">Banco no treino: ${x.liveBank.answered} questões · ${Math.round(x.liveBank.score)}% de acerto${x.liveBank.applied?' · contribuição conciliada na nota':' · nota antiga preservada'}. ${x.liveBank.reason?esc(x.liveBank.reason):''}</p>`:''}
 ${x.bankReconciliation?.status==='merged'?`<p class="small muted">Banco reconciliado: ${x.bankReconciliation.oldCount} antigas + ${x.bankReconciliation.nativeCount} novas, com ${x.bankReconciliation.overlap} IDs sobrepostos = ${x.bankReconciliation.total} questões distintas.</p>`:''}
 ${x.trainingMetrics?`<p class="small muted">Histórico compartilhado de questões: ${x.trainingMetrics.distinct} distintas, ${x.trainingMetrics.attempts} tentativas, ${x.trainingMetrics.due} revisões vencidas.</p>`:''}
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
   screen==='exercicios'&&route.length===4?await renderSharedExercises(bundle,view):
   screen==='aula'&&route.length===5?lessonView(bundle,Number(index),view):
   screen==='diagnostico'&&route.length===5?diagnosticView(bundle,Number(index),view):null;
 if(content===null)throw Error('Página do módulo inválida.');
 const isIndex=screen==='inicio'&&route.length===3;
 const targetMain=main;
 if(isCurrent())targetMain.innerHTML=`<div class="section-head"><div><p class="eyebrow">Motor compartilhado · Fase 8D</p><h1>${esc(bundle.moduleId)} — ${esc(bundle.title)}</h1></div>
 <a class="btn" href="${isIndex?`#materia/${esc(subjectId)}`:base}">${isIndex?'← Todos os módulos':'← Voltar ao módulo'}</a></div>
 ${progressNotice(view,subjectId)}${content}`;
}
let busy=false;
/** Recebe somente botões da rota de estudo e valida página + subtópico no bundle. */
export async function handleSharedModuleClick(event,rerender,{
 loader=loadSharedModule,storage=globalThis.localStorage,baselineReader=readSharedBaseline,viewLoader=buildSharedStudyView
}={}){
 const btn=event.target?.closest?.('button[data-shared-action],button[data-shared-exercise]');if(!btn)return false;
 if(busy)return true;busy=true;btn.disabled=true;
 try{
  const hash=globalThis.location?.hash??'';
  const route=decodeURIComponent(hash.slice(1)).split('/');
  const [,subjectId,moduleId,screen,index]=route;
  if(route[0]!=='estudo'||!getSubject(subjectId))throw Error('Abra um módulo válido.');
  if(btn.dataset.sharedExercise){
    if(route.length!==4||screen!=='exercicios')throw Error('Abra os exercícios do módulo.');
    await handleSharedExerciseClick(event,rerender,{storage,viewLoader});return true;
  }
  if(route.length!==5)throw Error('Abra uma aula ou diagnóstico para registrar a atividade.');
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
