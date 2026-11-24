/** Fase 8C — exercícios nativos, com uma única coleção de tentativas para
 * Banco, Revisão, Simulados e Exercícios. O registro antigo nunca é gravado.
 */
import {loadAdminQuestions} from './admin-catalog.js';
import {loadSharedModule} from './shared-module-loader.js';
import {readTrainingState,updateTrainingState} from './training-store.js';
import {readSharedBaseline,buildSharedStudyView} from './shared-activity-bridge.js';
import {fingerprintBaseline,sameBaseline} from './shared-activity-store.js';
import {selectExerciseQuestions,startLearningExercise,answerLearningExercise,
 assessLearningExercise,nextLearningExercise,exerciseSessionSummary,EXERCISE_REASONS} from './shared-exercise-engine.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
const letter=i=>String.fromCharCode(65+i);
const feedback=q=>`<section class="feedback"><h3>Gabarito: ${letter(q.answer)} — ${esc(q.options[q.answer])}</h3>
 ${q.explanation?`<p><strong>Fundamento:</strong> ${esc(q.explanation)}</p>`:''}
 ${Array.isArray(q.optionComments)&&q.optionComments.some(Boolean)?`<details><summary>Comentários das alternativas</summary><ol type="A">${q.optionComments.map(s=>`<li>${esc(s)}</li>`).join('')}</ol></details>`:''}
 ${q.concept?`<p><strong>Conceito:</strong> ${esc(q.concept)}</p>`:''}
 ${q.trap?`<p><strong>Atenção à pegadinha:</strong> ${esc(q.trap)}</p>`:''}
 ${q.newExample?`<p><strong>Exemplo adicional:</strong> ${esc(q.newExample)}</p>`:''}
 </section>`;
const button=(action,label,extra='')=>`<button type="button" class="btn ${extra}" data-shared-exercise="${action}">${label}</button>`;
export async function renderSharedExercises(bundle,view,{questionLoader=loadAdminQuestions,storage=globalThis.localStorage}={}){
 if(bundle.subjectId!=='administracao')return '<p class="notice">Exercícios dessa disciplina ainda dependem da publicação dos seus conteúdos.</p>';
 const questions=await questionLoader(bundle.moduleId);
 const result=readTrainingState(storage);if(!result.ok)throw Error(result.message);
 const state=result.state,s=state.exerciseSessions?.[bundle.moduleId],summary=exerciseSessionSummary(state,bundle.moduleId,questions);
 const base=`#estudo/administracao/${encodeURIComponent(bundle.moduleId)}`;
 const header=`<section class="panel"><h2>Praticar o que aprendi</h2>
 <p>Atividade original: todas as questões médias e 6 difíceis sorteadas, distribuídas entre subtópicos quando possível. Corrigimos uma resposta por vez, seguida da autoavaliação para agendar a revisão.</p>
 <p class="small muted">As respostas são registradas no mesmo histórico de questões do Banco, revisões e simulados, sem duplicar IDs. O componente Exercícios da nota passa a refletir esta sessão quando houver novas respostas.</p>
 <div class="inline-actions"><a href="${base}" class="btn">← Voltar ao módulo</a><a href="#treino-admin/revisao" class="btn">Revisões</a><a href="#treino-admin/simulado" class="btn">Simulados</a></div></section>`;
 if(view.locked)return header+`<p class="notice error">Atividades protegidas: ${esc(view.reason)}</p>`;
 if(!s){
   const mids=questions.filter(q=>q.difficulty==='media').length,hard=questions.filter(q=>q.difficulty==='dificil').length;
   return header+`<section class="activity-card"><h3>Iniciar exercícios</h3><p>${mids} questões médias + 6 sorteadas entre ${hard} difíceis.</p>
    ${mids>0&&hard>=6?button('start','Começar atividade','btn-primary'):'<p>Este módulo ainda não possui questões suficientes para este formato.</p>'}</section>`;
 }
 if(s.finishedAt){return header+`<section class="activity-card"><h3>Atividade concluída</h3>
  <p><strong>${summary.correct} de ${summary.total}</strong> questões corretas (${Math.round(summary.correct/summary.total*100)}%).
  Você poderá iniciar uma nova seleção; isso substitui apenas a etapa Exercícios na nota atual, sem apagar o histórico de tentativas.</p>
  ${button('start','Começar nova atividade','btn-primary')}</section>`;}
 const id=s.ids[s.cursor],q=questions.find(x=>x.id===id);
 if(!q)throw Error('Questão desta atividade não pertence mais ao catálogo; respostas preservadas.');
 const answered=Object.hasOwn(s.answers,id),assessed=Object.hasOwn(s.assessments,id);
 return header+`<article class="activity-card"><p class="eyebrow">Questão ${s.cursor+1} de ${s.ids.length} · ${esc(q.id)}</p>
 <div class="shared-exercise-track" role="progressbar" aria-valuemin="0" aria-valuemax="${s.ids.length}" aria-valuenow="${summary.answered}"><div style="width:${Math.round(summary.answered/s.ids.length*100)}%"></div></div>
 ${q.textBase&&!q.textBase.startsWith('[')?`<blockquote class="shared-text-base">${esc(q.textBase)}</blockquote>`:''}
 <h3>${esc(q.stem)}</h3>
 <div class="training-answers">${q.options.map((option,i)=>`<button type="button" class="choice ${answered&&s.answers[id]===i?'training-selected':''}" data-shared-exercise="answer" data-exercise-choice="${i}" ${answered?'disabled':''}>${letter(i)}. ${esc(option)}</button>`).join('')}</div>
 ${answered?`${feedback(q)}<section class="panel"><h3>Como você respondeu?</h3>
 ${assessed?`<p>Registrado: <strong>${esc(EXERCISE_REASONS[s.assessments[id].reason])}</strong>. Revisão em ${s.assessments[id].intervalDays} dia(s).</p>`:
 `<div class="inline-actions">${Object.entries(EXERCISE_REASONS).filter(([key])=>
 (s.answers[id]===q.answer?['seguro','duvida','chute']:['desconhecimento','pegadinha','interpretacao','desatencao']).includes(key))
 .map(([key,label])=>`<button type="button" class="btn" data-shared-exercise="assess" data-exercise-reason="${key}">${esc(label)}</button>`).join('')}</div>`}
 ${assessed?button('next',s.cursor===s.ids.length-1?'Concluir atividade':'Próxima questão','btn-primary'):''}</section>`:''}
 </article>`;
}
/** O baseline é rechecado no ato da gravação; o histórico v1 usa CAS otimista. */
export async function handleSharedExerciseClick(event,rerender,{
 storage=globalThis.localStorage,questionLoader=loadAdminQuestions,viewLoader=buildSharedStudyView,
 baselineReader=readSharedBaseline,moduleLoader=loadSharedModule
}={}){
 const btn=event.target?.closest?.('button[data-shared-exercise]');if(!btn)return false;
 const route=decodeURIComponent(globalThis.location?.hash?.slice(1)??'').split('/');
 if(route.length!==4||route[0]!=='estudo'||route[1]!=='administracao'||route[3]!=='exercicios')
  throw Error('Abra os exercícios do módulo antes de responder.');
 const mod=route[2],action=btn.dataset.sharedExercise;
 const bundle=await moduleLoader('administracao',mod);
 const view=await viewLoader(bundle,{storage});if(view.locked)throw Error(view.reason);
 const before=baselineReader(storage),signature=await fingerprintBaseline(before);
 if(globalThis.location?.hash!==`#${route.join('/')}`)throw Error('O módulo mudou durante a operação.');
 const questions=await questionLoader(mod),current=readTrainingState(storage);
 if(!current.ok)throw Error(current.message);
 const sess=current.state.exerciseSessions?.[mod];
 const q=sess?questions.find(x=>x.id===sess.ids[sess.cursor]):null;
 const r=updateTrainingState(state=>{
   const latest=baselineReader(storage);
   if(latest.source!==before.source||latest.raw!==before.raw)throw Error('A origem pedagógica mudou durante a operação.');
   if(state.exerciseBaseline&&!sameBaseline(state.exerciseBaseline,signature))
     throw Error('A origem dos exercícios mudou após o começo da sessão. Preserve um backup antes de reconciliar.');
   state.exerciseBaseline??=signature;
   if(action==='start')startLearningExercise(state,questions,mod);
   else if(action==='answer'){
     const value=Number(btn.dataset.exerciseChoice);
     if(!Number.isSafeInteger(value)||!q)throw Error('Alternativa inválida.');
     answerLearningExercise(state,q,value);
   }else if(action==='assess'){
     if(!q)throw Error('Questão indisponível.');
     assessLearningExercise(state,q,btn.dataset.exerciseReason);
   }else if(action==='next')nextLearningExercise(state,mod);
   else throw Error('Ação não reconhecida.');
 },storage,()=>{
   const latest=baselineReader(storage);
   if(latest.source!==before.source||latest.raw!==before.raw)
     throw Error('A fonte de estudo mudou antes da gravação. Nenhum registro foi alterado.');
 });
 if(!r.ok)throw Error(r.message);
 await rerender();return true;
}
