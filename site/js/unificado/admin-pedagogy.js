/**
 * Fase 7C — Espelho fiel do aproveitamento ADM-ESTUDO e importação protegida.
 * NÃO altera admEstudo.v2.state; NÃO adiciona tentativas à área de treino v1.
 * O conjunto importado fica em um registro pedagógico separado, sem fusão de notas.
 */
import {readLegacyState,validateLegacyState} from './legacy-compat.js';
import {EXISTING_ADM_KEY} from './storage-keys.js';
import {trainingKeyFor} from './training-store.js';

export const PEDAGOGY_FORMAT='estudo-concursos/admin-pedagogy-index/v1';
export const PEDAGOGY_STORAGE_KEY='estudoConcursos.v1.pedagogy.administracao';
export const PEDAGOGY_RECOVERY_KEY='estudoConcursos.v1.pedagogy-recovery.administracao';
export const PEDAGOGY_SNAPSHOT_FORMAT='estudo-concursos/admin-pedagogy-snapshot/v1';
export const PEDAGOGY_BACKUP_FORMAT='estudo-concursos/pedagogy-safety-backup/v1';
const TRAINING_KEY=trainingKeyFor('administracao');
const ratings={sei:100,duvida:50,nao:0};
const weights={diagnostic:20,lessonCompletion:15,lessonSelfAssessment:15,exercises:30,bank:20};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const clamp=x=>typeof x==='number'&&Number.isFinite(x)?Math.max(0,Math.min(100,x)):0;
const round2=x=>Math.round(x*100)/100;
const pct=(a,b)=>b>0?100*a/b:0;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clone=x=>JSON.parse(JSON.stringify(x));
const moduleId=/^(?:ADM|AP|DA)-\d{2}$/;
const indexUrl=new URL('../../administracao/catalogo-leve/pedagogia-index.json',import.meta.url);
let indexPromise=null;

export function validatePedagogyIndex(index){
  if(!object(index)||index.format!==PEDAGOGY_FORMAT||index.moduleCount!==27||
     index.questionCount!==757||!Array.isArray(index.modules)||index.modules.length!==27||
     typeof index.catalogSha256!=='string'||!/^[0-9a-f]{64}$/.test(index.catalogSha256))
    throw Error('Índice pedagógico administrativo incompleto ou incompatível.');
  const mods=new Set(),ids=new Set();let total=0;
  for(const m of index.modules){
    if(!object(m)||!moduleId.test(m.id)||mods.has(m.id)||typeof m.title!=='string'||
      !Array.isArray(m.subtopicIds)||!Array.isArray(m.diagnosticIds)||!Array.isArray(m.lessonIds)||!Array.isArray(m.bank))
      throw Error('Módulo pedagógico inválido.');
    mods.add(m.id);
    if(new Set(m.subtopicIds).size!==m.subtopicIds.length||!m.subtopicIds.every(id=>typeof id==='string'&&id.startsWith(m.id+'-'))||
       !m.diagnosticIds.every(id=>m.subtopicIds.includes(id))||!m.lessonIds.every(id=>m.subtopicIds.includes(id)))
      throw Error(`Subtópicos pedagógicos inválidos em ${m.id}.`);
    for(const q of m.bank){
      if(!object(q)||typeof q.id!=='string'||!q.id||ids.has(q.id)||!Number.isInteger(q.answer)||
        !Number.isInteger(q.optionCount)||q.optionCount<2||q.answer<0||q.answer>=q.optionCount)
        throw Error('Gabarito técnico incompleto ou ID duplicado.');
      ids.add(q.id);total++;
    }
  }
  if(total!==757)throw Error('O índice não contém todas as 757 questões.');
  return index;
}
export async function loadPedagogyIndex(fetcher=(url)=>fetch(url,{cache:'no-store'})){
  if(fetcher!==undefined && arguments.length){
    const response=await fetcher(indexUrl.href);
    if(!response?.ok)throw Error('Índice pedagógico não publicado: confira o GitHub Actions.');
    return validatePedagogyIndex(await response.json());
  }
  if(!indexPromise)indexPromise=loadPedagogyIndex((url)=>fetch(url,{cache:'no-store'}))
    .catch(err=>{indexPromise=null;throw err});
  return indexPromise;
}

/** Espelha exatamente a regra F23/L04: pontos conquistados e cobertura PARCIAL. */
export function calculatePartialAchievement(scores={}){
  let earned=0,assessed=0;const components={};
  for(const [key,weight] of Object.entries(weights)){
    const item=scores[key],available=item?.available===true;
    const score=available?clamp(item.score):0;
    const coverage=available?(item.coverage===undefined?100:clamp(item.coverage)):0;
    const points=round2(weight*score/100*coverage/100);
    const coverageWeight=round2(weight*coverage/100);
    components[key]={weight,points,available,score,coverage,coverageWeight};
    earned+=points;assessed+=coverageWeight;
  }
  earned=round2(earned);assessed=round2(assessed);
  return {percentage:assessed>0?Math.floor(earned+1e-8):null,
    earnedWeightedPoints:earned,availableWeight:assessed,coveragePercentage:assessed,
    hasData:assessed>0,completed:assessed>0&&earned>=75,components};
}

/** Dados do legado APENAS: não mistura respostas feitas no motor novo. */
export function modulePedagogy(legacy,module){
  validateLegacyState(legacy);
  const p=legacy.progress;
  const diagAnswers=object(p.diagnostics[module.id]?.answers)?p.diagnostics[module.id].answers:{};
  const diag=module.diagnosticIds;
  const valid=diag.filter(id=>own(ratings,diagAnswers[id]));
  const lessonIds=module.lessonIds;
  const completed=lessonIds.filter(id=>p.lessons[id]?.completed===true);
  const rated=lessonIds.filter(id=>own(ratings,p.lessons[id]?.rating));
  const lookup=new Map(module.bank.map(q=>[q.id,q]));
  const session=p.exercises[module.id];
  const examIds=Array.isArray(session?.ids)?session.ids:[];
  const answered=examIds.filter(id=>Number.isInteger(session.answers?.[id]));
  const correct=examIds.filter(id=>{const q=lookup.get(id);return q&&session.answers?.[id]===q.answer;}).length;
  const seen=new Set();let bankTotal=0,bankAnswered=0,bankCorrect=0;
  for(const q of module.bank){
    if(seen.has(q.id))continue;seen.add(q.id);bankTotal++;
    const history=object(p.questionHistory[q.id])?p.questionHistory[q.id]:{};
    const bank=object(history.bankAttempt)?history.bankAttempt:{};
    const answer=Number.isInteger(bank.lastAnswer)?bank.lastAnswer:
      (['acerto_banco','erro_banco'].includes(history.assessment)?history.lastAnswer:null);
    if(!Number.isInteger(answer)||answer<0||answer>=q.optionCount)continue;
    bankAnswered++;if(answer===q.answer)bankCorrect++;
  }
  const scores={};
  if(valid.length&&diag.length)scores.diagnostic={available:true,
    score:valid.reduce((n,id)=>n+ratings[diagAnswers[id]],0)/valid.length,
    coverage:pct(valid.length,diag.length)};
  if(lessonIds.length){
    if(completed.length)scores.lessonCompletion={available:true,score:100,coverage:pct(completed.length,lessonIds.length)};
    if(rated.length)scores.lessonSelfAssessment={available:true,
      score:rated.reduce((n,id)=>n+ratings[p.lessons[id].rating],0)/rated.length,
      coverage:pct(rated.length,lessonIds.length)};
  }
  if(answered.length&&examIds.length)scores.exercises={available:true,
    score:pct(correct,answered.length),coverage:pct(answered.length,examIds.length)};
  if(bankAnswered)scores.bank={available:true,score:pct(bankCorrect,bankAnswered),coverage:100};
  const result=calculatePartialAchievement(scores);
  return {...result,moduleId:module.id,moduleTitle:module.title,
    evidence:{diagnostic:valid.length,diagnosticTotal:diag.length,lessonsCompleted:completed.length,
      lessonsRated:rated.length,lessonTotal:lessonIds.length,exerciseAnswered:answered.length,
      exerciseTotal:examIds.length,bankAnswered,bankTotal,bankCorrect}};
}
export function allModulePedagogy(legacy,index){
  validateLegacyState(legacy);validatePedagogyIndex(index);
  return index.modules.map(m=>modulePedagogy(legacy,m));
}

/** Somente informações cuja correspondência com o catálogo é inequívoca. */
export function planPedagogyImport(legacy,index,{now=new Date().toISOString()}={}){
  validateLegacyState(legacy);validatePedagogyIndex(index);
  if(!validDate(now))throw Error('Data inválida.');
  const p=legacy.progress,output={diagnostics:{},lessons:{},exercises:{}};
  const counts={diagnosticAnswers:0,lessonsCompleted:0,lessonRatings:0,
    exerciseModules:0,exerciseAnswers:0,skippedExerciseModules:0,unknownDiagnosticAnswers:0,unknownLessons:0};
  const knownLessons=new Set(index.modules.flatMap(m=>m.lessonIds));
  for(const module of index.modules){
    const d=object(p.diagnostics[module.id]?.answers)?p.diagnostics[module.id].answers:{};
    const filtered={};for(const id of module.diagnosticIds){
      if(own(ratings,d[id])){filtered[id]=d[id];counts.diagnosticAnswers++;}
    }
    counts.unknownDiagnosticAnswers+=Object.keys(d).filter(id=>!own(filtered,id)).length;
    if(Object.keys(filtered).length)output.diagnostics[module.id]={answers:filtered,
      updatedAt:validDate(p.diagnostics[module.id]?.updatedAt)?p.diagnostics[module.id].updatedAt:null};
    for(const id of module.lessonIds){
      const v=p.lessons[id];if(!object(v))continue;
      const rec={};if(v.completed===true){rec.completed=true;counts.lessonsCompleted++;}
      if(own(ratings,v.rating)){rec.rating=v.rating;counts.lessonRatings++;}
      if(Object.keys(rec).length){rec.updatedAt=validDate(v.updatedAt)?v.updatedAt:null;output.lessons[id]=rec;}
    }
    const session=p.exercises[module.id];
    if(!object(session))continue;
    const ids=session.ids;
    const qs=new Map(module.bank.map(q=>[q.id,q]));
    if(!Array.isArray(ids)||ids.length===0||new Set(ids).size!==ids.length||ids.some(id=>!qs.has(id))||
       !object(session.answers)||Object.entries(session.answers).some(([id,answer])=>
       !ids.includes(id)||!Number.isInteger(answer)||answer<0||answer>=qs.get(id).optionCount)){
      counts.skippedExerciseModules++;continue;
    }
    const answers=Object.fromEntries(ids.filter(id=>own(session.answers,id)).map(id=>[id,session.answers[id]]));
    output.exercises[module.id]={ids:[...ids],answers,
      finishedAt:validDate(session.finishedAt)?session.finishedAt:null,
      startedAt:validDate(session.startedAt)?session.startedAt:null};
    counts.exerciseModules++;counts.exerciseAnswers+=Object.keys(answers).length;
  }
  counts.unknownLessons=Object.keys(p.lessons).filter(id=>!knownLessons.has(id)).length;
  const achievements=allModulePedagogy(legacy,index).filter(a=>a.hasData);
  const importedItems=counts.diagnosticAnswers+counts.lessonsCompleted+counts.lessonRatings+counts.exerciseAnswers;
  return {format:PEDAGOGY_SNAPSHOT_FORMAT,schemaVersion:1,subjectId:'administracao',
    metadata:{importedAt:now,sourceKey:EXISTING_ADM_KEY,sourceSchemaVersion:3,
      catalogSha256:index.catalogSha256,sourceUpdatedAt:legacy.metadata?.updatedAt??null},
    counts:{...counts,modulesWithActivity:achievements.length,importedItems},
    progress:output,achievements:Object.fromEntries(achievements.map(a=>[a.moduleId,a]))};
}

export function readPedagogySnapshot(storage=globalThis.localStorage){
  try{const raw=storage.getItem(PEDAGOGY_STORAGE_KEY);
    if(raw===null)return {ok:true,exists:false,raw:null,snapshot:null};
    const snapshot=JSON.parse(raw);
    if(snapshot?.format!==PEDAGOGY_SNAPSHOT_FORMAT||snapshot.schemaVersion!==1||
      snapshot.subjectId!=='administracao'||!object(snapshot.progress)||!object(snapshot.achievements))
      throw Error('Registro pedagógico incompatível.');
    return {ok:true,exists:true,raw,snapshot};
  }catch(e){return {ok:false,exists:true,message:e.message};}
}
export function preparePedagogyImport(index,{storage=globalThis.localStorage,now=new Date().toISOString()}={}){
  const old=readLegacyState(storage);
  if(!old.ok)throw Error(old.message);
  if(!old.exists)throw Error('Não há histórico original neste navegador.');
  const snap=readPedagogySnapshot(storage);
  if(!snap.ok)throw Error(snap.message);
  if(snap.exists)throw Error('Já existe uma importação pedagógica. Ela foi preservada; não há sobrescrita automática.');
  if(storage.getItem(PEDAGOGY_RECOVERY_KEY)!==null)throw Error('Há uma recuperação pedagógica pendente; resolva-a antes de importar.');
  const trainingRaw=storage.getItem(TRAINING_KEY);
  return {plan:planPedagogyImport(old.state,index,{now}),legacyRaw:old.raw,trainingRaw,
    pedagogyRaw:null};
}
/** Grava SOMENTE a nova chave, guardando antes a cópia de recuperação exata. */
export function commitPedagogyImport(draft,{storage=globalThis.localStorage,backupConfirmed=false}={}){
  if(!backupConfirmed)return {ok:false,message:'Confirme que guardou o backup antes de importar.'};
  if(!draft?.plan||draft.plan.format!==PEDAGOGY_SNAPSHOT_FORMAT||!draft.plan.counts?.importedItems)
    return {ok:false,message:'Não há registros pedagógicos verificáveis para importar.'};
  try{
    if(storage.getItem(PEDAGOGY_RECOVERY_KEY)!==null||storage.getItem(PEDAGOGY_STORAGE_KEY)!==draft.pedagogyRaw)
      throw Error('Já existe uma cópia de recuperação ou registro pedagógico.');
    if(storage.getItem(EXISTING_ADM_KEY)!==draft.legacyRaw||storage.getItem(TRAINING_KEY)!==draft.trainingRaw)
      throw Error('Os históricos mudaram depois da prévia. Refaça a conferência.');
    const serialized=JSON.stringify(draft.plan);
    const recovery=JSON.stringify({format:'estudo-concursos/pedagogy-recovery/v1',
      previousRaw:draft.pedagogyRaw,afterRaw:serialized,createdAt:new Date().toISOString()});
    storage.setItem(PEDAGOGY_RECOVERY_KEY,recovery);
    if(storage.getItem(PEDAGOGY_RECOVERY_KEY)!==recovery)throw Error('Não foi possível confirmar a recuperação.');
    if(storage.getItem(EXISTING_ADM_KEY)!==draft.legacyRaw||storage.getItem(TRAINING_KEY)!==draft.trainingRaw||
       storage.getItem(PEDAGOGY_STORAGE_KEY)!==draft.pedagogyRaw)
      throw Error('Os dados mudaram durante a importação; gravação bloqueada.');
    storage.setItem(PEDAGOGY_STORAGE_KEY,serialized);
    if(storage.getItem(PEDAGOGY_STORAGE_KEY)!==serialized)throw Error('A gravação não pôde ser confirmada.');
    return {ok:true,counts:draft.plan.counts};
  }catch(e){return {ok:false,message:String(e.message||e)};}
}
export function inspectPedagogyRecovery(storage=globalThis.localStorage){
  const raw=storage.getItem(PEDAGOGY_RECOVERY_KEY);
  if(raw===null)return {exists:false,canRestore:false,canDiscard:false};
  try{const item=JSON.parse(raw);if(item.format!=='estudo-concursos/pedagogy-recovery/v1')throw Error('Cópia inválida.');
    const current=storage.getItem(PEDAGOGY_STORAGE_KEY);
    return {exists:true,canRestore:current===item.afterRaw,
      canDiscard:current===item.previousRaw,createdAt:item.createdAt};
  }catch{return {exists:true,canRestore:false,canDiscard:false};}
}
export function restorePedagogyImport({storage=globalThis.localStorage,confirmed=false}={}){
  if(!confirmed)return {ok:false,message:'Confirme a recuperação antes de continuar.'};
  try{
    const raw=storage.getItem(PEDAGOGY_RECOVERY_KEY);if(raw===null)throw Error('Sem recuperação pendente.');
    const item=JSON.parse(raw);if(item.format!=='estudo-concursos/pedagogy-recovery/v1')throw Error('Formato incompatível.');
    const current=storage.getItem(PEDAGOGY_STORAGE_KEY);
    if(current!==item.afterRaw&&current!==item.previousRaw)throw Error('Registro alterado após a importação; não será sobrescrito.');
    if(current===item.afterRaw){
      if(item.previousRaw===null)storage.removeItem(PEDAGOGY_STORAGE_KEY);
      else storage.setItem(PEDAGOGY_STORAGE_KEY,item.previousRaw);
      if(storage.getItem(PEDAGOGY_STORAGE_KEY)!==item.previousRaw)throw Error('Falha ao restaurar o valor anterior.');
    }
    storage.removeItem(PEDAGOGY_RECOVERY_KEY);
    return {ok:true,message:'Importação pedagógica desfeita. O progresso original não foi alterado.'};
  }catch(e){return {ok:false,message:String(e.message||e)};}
}
export function buildPedagogyBackup(storage=globalThis.localStorage,now=new Date().toISOString()){
  if(!validDate(now))throw Error('Data de backup inválida.');
  const keys=[EXISTING_ADM_KEY,TRAINING_KEY,PEDAGOGY_STORAGE_KEY,PEDAGOGY_RECOVERY_KEY];
  const entries=keys.map(key=>({key,raw:storage.getItem(key)}));
  if(entries.every(e=>e.raw===null))throw Error('Nenhum histórico encontrado neste navegador.');
  return {format:PEDAGOGY_BACKUP_FORMAT,createdAt:now,
    note:'Cópia bruta de segurança; não é importada automaticamente nos aplicativos.',entries};
}
