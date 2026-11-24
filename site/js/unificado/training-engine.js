/** Fase 6 — regras de treino reutilizáveis, sem dependência do DOM nem do armazenamento. */
export const TRAINING_SCHEMA_VERSION = 1;
export const TRAINING_KEY = 'estudoConcursos.v1.training.administracao';
const MODULE_ID = /^[A-Z]{2,5}-\d{2,3}$/;
const SUBJECT_ID = /^[a-z][a-z0-9-]{2,40}$/;
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

export function createTrainingState(now = new Date().toISOString(),subjectId='administracao') {
  if(!SUBJECT_ID.test(subjectId))throw Error('Identificador de disciplina inválido.');
  return {schemaVersion:TRAINING_SCHEMA_VERSION, subjectId,
    metadata:{createdAt:now,updatedAt:null},questions:{},session:null,simulations:[],exerciseSessions:{}};
}
export function validateTrainingState(state,expectedSubjectId=null) {
  if (!isObj(state) || state.schemaVersion!==TRAINING_SCHEMA_VERSION || !SUBJECT_ID.test(state.subjectId) || (expectedSubjectId!==null&&state.subjectId!==expectedSubjectId) ||
      !isObj(state.questions) || !Array.isArray(state.simulations) || !(state.session===null || isObj(state.session)) ||
      (state.exerciseSessions!==undefined&&!isObj(state.exerciseSessions)))
    throw Error('Histórico da nova área incompatível. Salvamento bloqueado; os dados foram preservados.');
  if (!isObj(state.metadata)) throw Error('Metadados do treino inválidos.');
  for(const [id, item] of Object.entries(state.questions)) {
    if(!id || !isObj(item) || !MODULE_ID.test(item.moduleId) || !Number.isInteger(item.attempts) || item.attempts<1 ||
       !Number.isInteger(item.correct) || item.correct<0 || item.correct>item.attempts || !Array.isArray(item.history))
      throw Error('Há respostas incompatíveis no histórico. Salvamento bloqueado.');
  }
  if(state.session) {
    const s=state.session;
    if(!['general','module'].includes(s.scope) || !Array.isArray(s.ids) || !s.ids.length ||
      new Set(s.ids).size!==s.ids.length || !isObj(s.answers) || !isObj(s.moduleIds) || s.ids.some(id=>!MODULE_ID.test(s.moduleIds[id])) || !Number.isInteger(s.cursor) ||
      s.cursor<0 || s.cursor>=s.ids.length)throw Error('Simulado salvo incompatível; preservado sem alterações.');
  }
  return state;
}
export function validateQuestion(q) {
  if(!q || typeof q.id!=='string' || !MODULE_ID.test(q.moduleId) || !Array.isArray(q.options) || q.options.length<2 ||
     !Number.isInteger(q.answer) || q.answer<0 || q.answer>=q.options.length)throw Error('Questão inválida.');
  return q;
}
const addDays=(iso,days)=>new Date(Date.parse(iso)+days*86400000).toISOString();
/** Intervalos simples da área nova, NÃO substituem a revisão adaptativa antiga. */
export function recordTrainingAttempt(state,question,selected,{source='bank',now=new Date().toISOString()}={}) {
  validateTrainingState(state);validateQuestion(question);
  if(!['bank','review','exam','exercise'].includes(source) || !Number.isInteger(selected) || selected<0 || selected>=question.options.length || !Number.isFinite(Date.parse(now)))
    throw Error('Tentativa inválida.');
  const prev=state.questions[question.id];
  if(prev && prev.moduleId!==question.moduleId)throw Error('Questão mudou de módulo; operação bloqueada.');
  const right=selected===question.answer;
  const everWrong=!right || (prev?.everWrong??false);
  const streak=right ? (prev?.streak??0)+1 : 0;
  // Só agenda revisão para quem errou alguma vez; não interfere nas regras do ADM antigo.
  const intervals=[1,3,7,15,30];
  const dueAt=everWrong ? addDays(now,right?intervals[Math.min(streak,intervals.length-1)]:1) : null;
  const rec={moduleId:question.moduleId,attempts:(prev?.attempts??0)+1,
    correct:(prev?.correct??0)+(right?1:0),lastAnswer:selected,lastCorrect:right,updatedAt:now,
    everWrong,streak,dueAt,
    history:[...(prev?.history??[]),{at:now,answer:selected,correct:right,source}]};
  state.questions[question.id]=rec;
  return {correct:right,record:rec};
}
export function summarizeTraining(state,{now=new Date().toISOString()}={}) {
  validateTrainingState(state);
  const items=Object.entries(state.questions);
  const totals={distinct:items.length,attempts:0,correct:0,wrongQuestions:0,due:0,simulations:state.simulations.length,modules:{},
    bySource:{bank:0,review:0,exam:0,exercise:0}};
  for(const [,r] of items){
    totals.attempts+=r.attempts;totals.correct+=r.correct;
    for(const h of r.history)if(Object.hasOwn(totals.bySource,h?.source))totals.bySource[h.source]++;
    if(r.everWrong)totals.wrongQuestions++;
    if((r.everWrong||r.reviewEligible) && r.dueAt && r.dueAt<=now)totals.due++;
    const m=totals.modules[r.moduleId]??={distinct:0,attempts:0,correct:0,due:0};
    m.distinct++;m.attempts+=r.attempts;m.correct+=r.correct;
    if((r.everWrong||r.reviewEligible) && r.dueAt && r.dueAt<=now)m.due++;
  }
  totals.accuracy=totals.attempts?Math.round(100*totals.correct/totals.attempts):null;
  return totals;
}
export function reviewEntries(state,{dueOnly=true,now=new Date().toISOString()}={}) {
  validateTrainingState(state);
  return Object.entries(state.questions).filter(([,r])=>(r.everWrong||r.reviewEligible) && r.dueAt && (!dueOnly || r.dueAt<=now))
    .map(([id,r])=>({id,moduleId:r.moduleId,dueAt:r.dueAt,attempts:r.attempts,streak:r.streak}))
    .sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.id.localeCompare(b.id));
}
function shuffle(a,random=Math.random){const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out;}
/** Seleciona apenas módulos necessários: modo geral usa até 10 módulos, sem baixar os 27. */
export async function selectExamQuestions(manifest,loadModule,{scope='general',moduleId=null,count=20,random=Math.random}={}) {
  if(!Number.isInteger(count)||count<1||count>40)throw Error('Quantidade inválida.');
  const modules=manifest?.modules;
  if(!Array.isArray(modules)||!modules.length)throw Error('Catálogo de módulos indisponível.');
  if(scope==='module'){
    const target=modules.find(x=>x.id===moduleId);if(!target)throw Error('Módulo desconhecido.');
    const questions=await loadModule(target.id);
    if(questions.length<count)throw Error('O módulo não possui questões suficientes para este simulado.');
    return shuffle(questions,random).slice(0,count);
  }
  if(scope!=='general')throw Error('Escopo inválido.');
  const targets=shuffle(modules.filter(x=>x.count>0),random).slice(0,Math.min(10,modules.length));
  const loaded=await Promise.all(targets.map(x=>loadModule(x.id)));
  const pools=loaded.map(arr=>shuffle(arr,random));
  const selected=[];
  for(let index=0;selected.length<count && pools.some(x=>x.length);index++) {
    const pool=pools[index%pools.length];if(pool.length)selected.push(pool.pop());
    if(index>5000)throw Error('Falha ao selecionar questões.');
  }
  if(selected.length<count)throw Error('Não há questões suficientes para o simulado.');
  if(new Set(selected.map(q=>q.id)).size!==selected.length)throw Error('Seleção duplicada; simulado bloqueado.');
  return shuffle(selected,random);
}
export function createExam(state,questions,{scope='general',moduleId=null,now=new Date().toISOString()}={}) {
  validateTrainingState(state);
  if(state.session)throw Error('Já existe um simulado em andamento.');
  if(!Array.isArray(questions)||questions.length<1 || new Set(questions.map(q=>q.id)).size!==questions.length)throw Error('Seleção inválida.');
  questions.forEach(validateQuestion);
  state.session={id:`SIM-${now}-${Math.random().toString(36).slice(2,9)}`,
    scope,moduleId,startedAt:now,ids:questions.map(q=>q.id),moduleIds:Object.fromEntries(questions.map(q=>[q.id,q.moduleId])),answers:{},cursor:0};
  return state.session;
}
export function answerExam(state,qid,selected,questions) {
  validateTrainingState(state);
  const sess=state.session;
  if(!sess||!sess.ids.includes(qid))throw Error('Questão não está neste simulado.');
  const q=questions.find(x=>x.id===qid);validateQuestion(q);
  if(!Number.isInteger(selected)||selected<0||selected>=q.options.length)throw Error('Alternativa inválida.');
  sess.answers[qid]=selected;return sess;
}
export function navigateExam(state,delta){validateTrainingState(state);if(!state.session)throw Error('Simulado ausente.');state.session.cursor=Math.max(0,Math.min(state.session.ids.length-1,state.session.cursor+delta));}
export function finishExam(state,questions,{now=new Date().toISOString()}={}) {
  validateTrainingState(state);
  const sess=state.session;if(!sess)throw Error('Simulado não encontrado.');
  const lookup=new Map(questions.map(q=>[q.id,q]));
  if(sess.ids.some(id=>!Object.hasOwn(sess.answers,id)||!lookup.has(id)))throw Error('Responda todas as questões antes de finalizar.');
  let correct=0;
  for(const id of sess.ids){const result=recordTrainingAttempt(state,lookup.get(id),sess.answers[id],{source:'exam',now});if(result.correct)correct++;}
  const outcome={id:sess.id,scope:sess.scope,moduleId:sess.moduleId,startedAt:sess.startedAt,finishedAt:now,
    total:sess.ids.length,correct,score:Math.round(100*correct/sess.ids.length)};
  state.simulations.unshift(outcome);state.session=null;
  return outcome;
}
