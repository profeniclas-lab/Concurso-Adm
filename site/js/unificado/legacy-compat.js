/**
 * ESTUDO-CONCURSOS — Fase 7. Compatibilidade SOMENTE LEITURA.
 * Dados de Administração v3 e treino v1 permanecem em suas chaves originais.
 * Nenhuma soma de notas, tentativas ou agendamentos de origens diferentes.
 */
import {validateTrainingState, summarizeTraining} from './training-engine.js';
import {EXISTING_ADM_KEY} from './storage-keys.js';
import {trainingKeyFor} from './training-store.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const isAnswer = value => Number.isInteger(value) && value >= 0;
export const LEGACY_SCHEMA_VERSION = 3;
export const COMPATIBILITY_FORMAT = 'estudo-concursos-dual-history-snapshot/v1';

/** Estrutura mínima baseada no schema 3; não normaliza nem regrava o legado. */
export function validateLegacyState(state) {
  if(!object(state) || state.schemaVersion !== LEGACY_SCHEMA_VERSION ||
     !object(state.progress) || !object(state.navigation) ||
     !object(state.preferences) || !object(state.metadata))
    throw Error('Progresso original incompatível; a chave antiga foi preservada.');
  const p=state.progress;
  for(const key of ['modules','lessons','diagnostics','exercises','questionHistory','flashcards'])
    if(!object(p[key]))throw Error(`Progresso original inválido em progress.${key}. Nenhum dado foi alterado.`);
  if(!Array.isArray(p.errors) || !Array.isArray(p.reviewQueue))
    throw Error('Listas do progresso original inválidas. Nenhum dado foi alterado.');
  if(p.simulados!==undefined && (!object(p.simulados) || (p.simulados.history!==undefined && !Array.isArray(p.simulados.history))))
    throw Error('Histórico antigo de simulados incompatível.');
  if(p.reviewSchedule!==undefined && !object(p.reviewSchedule))
    throw Error('Agendamentos antigos incompatíveis.');
  return state;
}

/** Leitura explícita, sem setItem, mesmo com JSON quebrado. */
export function readLegacyState(storage=globalThis.localStorage) {
  try {
    const raw=storage.getItem(EXISTING_ADM_KEY);
    if(raw===null)return {ok:true,exists:false,state:null,raw:null};
    const state=validateLegacyState(JSON.parse(raw));
    return {ok:true,exists:true,state,raw};
  }catch(error){return {ok:false,exists:true,state:null,raw:null,message:String(error.message||error)};}
}

/**
 * Considera "respondida" somente se houver resposta numérica registrada.
 * Tentativa rastreada prevalece para reconhecer presença; NÃO fabricamos
 * uma contagem de acertos de registros resumidos antigos.
 */
export function legacyAnsweredQuestionIds(state) {
  if(!state)return new Set();
  validateLegacyState(state);
  const ids=new Set();
  for(const [id,item] of Object.entries(state.progress.questionHistory)) {
    if(!object(item) || !id)continue;
    const tracked=Array.isArray(item.attempts) && item.attempts.some(a=>object(a)&&isAnswer(a.answer));
    if(tracked || isAnswer(item.lastAnswer) || isAnswer(item.bankAttempt?.lastAnswer)) ids.add(id);
  }
  return ids;
}

function legacyDetails(state,now) {
  const p=state.progress;
  const answeredIds=legacyAnsweredQuestionIds(state);
  const attempts=Object.values(p.questionHistory).reduce((n,item)=>n+(Array.isArray(item?.attempts)?item.attempts.filter(a=>object(a)&&isAnswer(a.answer)).length:0),0);
  const lessonCount=Object.values(p.lessons).filter(x=>object(x)&&x.completed===true).length;
  const diagnostics=Object.values(p.diagnostics).filter(x=>object(x)&&Object.keys(object(x.answers)?x.answers:{}).length>0).length;
  const examCount=Array.isArray(p.simulados?.history)?p.simulados.history.length:0;
  const allReviews=new Map();
  // Mesma questão em reviewAt e reviewSchedule conta apenas uma vez.
  for(const [id,item] of Object.entries(p.questionHistory)) {
    if(validDate(item?.reviewAt))allReviews.set(id,item.reviewAt);
  }
  for(const [key,item] of Object.entries(object(p.reviewSchedule)?p.reviewSchedule:{})) {
    if(validDate(item?.dueAt))allReviews.set(item.questionId||key,item.dueAt);
  }
  const due=[...allReviews.values()].filter(date=>date<=now).length;
  return {answeredIds,distinct:answeredIds.size,trackedAttempts:attempts,lessons:lessonCount,
          diagnosticModules:diagnostics,simulations:examCount,scheduledReviews:allReviews.size,due};
}

/** Não usa o total de questões como "respondidas" e não soma taxas de acerto. */
export function compareHistories(legacyState,trainingState,{now=new Date().toISOString()}={}) {
  validateTrainingState(trainingState,'administracao');
  if(legacyState!==null)validateLegacyState(legacyState);
  const original=legacyState===null?null:legacyDetails(legacyState,now);
  const modern=summarizeTraining(trainingState,{now});
  const newIds=new Set(Object.keys(trainingState.questions));
  const oldIds=original?.answeredIds ?? new Set();
  const both=[...oldIds].filter(id=>newIds.has(id)).length;
  const union=new Set([...oldIds,...newIds]);
  const oldOnly=oldIds.size-both,newOnly=newIds.size-both;
  return {
    hasLegacy:legacyState!==null,
    legacy:original?{distinct:original.distinct,trackedAttempts:original.trackedAttempts,
      lessons:original.lessons,diagnosticModules:original.diagnosticModules,simulations:original.simulations,
      scheduledReviews:original.scheduledReviews,due:original.due}:null,
    modern:{distinct:modern.distinct,attempts:modern.attempts,accuracy:modern.accuracy,
      simulations:modern.simulations,scheduledReviews:modern.wrongQuestions,due:modern.due},
    distinctUnion:union.size,overlap:both,oldOnly,newOnly,
    limitations:[
      'A soma representa questões distintas por ID, não o índice pedagógico de aproveitamento.',
      'Questões antigas sem alternativa numérica registrada não entram na união.',
      'Tentativas e revisões de motores diferentes permanecem separadas.',
      'O mesmo ID pode se referir a versões editoriais diferentes; a contagem não prova equivalência de conteúdo.',
      'A importação de tentativas detalhadas é manual e não transfere aulas, aproveitamento, simulados históricos ou agendamentos.'
    ]
  };
}

/** Backup manual de emergência: copia strings originais exatamente como armazenadas. */
export function buildDualHistorySnapshot(storage=globalThis.localStorage,now=new Date().toISOString()) {
  if(!validDate(now))throw Error('Data inválida.');
  const legacyKey=EXISTING_ADM_KEY,trainingKey=trainingKeyFor('administracao');
  const legacyRaw=storage.getItem(legacyKey),trainingRaw=storage.getItem(trainingKey);
  if(legacyRaw===null && trainingRaw===null)throw Error('Não há histórico para exportar neste navegador.');
  // Não tente corrigir dados incompatíveis. O backup raw deve funcionar inclusive nesses casos.
  return {format:COMPATIBILITY_FORMAT,version:1,createdAt:now,subjectId:'administracao',
    note:'Cópia bruta de segurança. Este arquivo NÃO é um backup restaurável diretamente pelos aplicativos.',
    entries:[{key:legacyKey,raw:legacyRaw},{key:trainingKey,raw:trainingRaw}]};
}
