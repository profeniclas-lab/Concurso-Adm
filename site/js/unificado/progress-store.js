import {assertKnownSubject} from './subjects.js';
import {getSubjectStorageKey,isLegacySubject} from './storage-keys.js';
export const SUBJECT_PROGRESS_SCHEMA=1;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function createSubjectProgress(subjectId){
  assertKnownSubject(subjectId);
  if(isLegacySubject(subjectId))throw new Error('Administração tem progresso próprio e não deve ser gravada pelo novo motor.');
  return {schemaVersion:SUBJECT_PROGRESS_SCHEMA,subjectId,
    metadata:{createdAt:new Date().toISOString(),updatedAt:null},
    progress:{lessons:{},diagnostics:{},exercises:{},questionHistory:{},flashcards:{}}};
}
/** Se houver dados incompatíveis, NÃO apagamos nem substituímos. */
export function readSubjectProgress(subjectId, storage=globalThis.localStorage){
  if(isLegacySubject(subjectId))throw new Error('Use readAdminProgress para Administração.');
  try{
    const raw=storage.getItem(getSubjectStorageKey(subjectId));
    if(raw===null)return {ok:true,raw:null,state:createSubjectProgress(subjectId)};
    const state=JSON.parse(raw);
    if(!obj(state)||state.schemaVersion!==SUBJECT_PROGRESS_SCHEMA||state.subjectId!==subjectId||!obj(state.progress))throw Error('Formato de progresso incompatível. Nenhum dado será alterado.');
    for(const key of ['lessons','diagnostics','exercises','questionHistory','flashcards'])if(!obj(state.progress[key]))throw Error(`Campo progress.${key} inválido. Nenhum dado será alterado.`);
    return {ok:true,raw,state};
  }catch(error){return {ok:false,raw:null,state:null,message:String(error.message||error)}};
}
/** CAS otimista; rejeita alterações simultâneas, sem reset silencioso. */
export function saveSubjectProgress(subjectId,expectedRaw,state,storage=globalThis.localStorage){
  if(isLegacySubject(subjectId))return {ok:false,message:'O progresso de Administração é protegido.'};
  if(!obj(state)||state.subjectId!==subjectId||state.schemaVersion!==SUBJECT_PROGRESS_SCHEMA)return {ok:false,message:'Estado incompatível.'};
  try{
    const key=getSubjectStorageKey(subjectId);
    if(storage.getItem(key)!==expectedRaw)return {ok:false,message:'O progresso mudou em outra aba. Recarregue antes de salvar.'};
    const newState={...state,metadata:{...state.metadata,updatedAt:new Date().toISOString()}};
    const serialized=JSON.stringify(newState);
    storage.setItem(key,serialized);
    if(storage.getItem(key)!==serialized)throw Error('Não foi possível confirmar a gravação.');
    return {ok:true,raw:serialized,state:newState};
  }catch(error){return {ok:false,message:String(error.message||error)}};
}
/** SOMENTE leitura da chave do aplicativo administrativo original. */
export function readAdminProgress(storage=globalThis.localStorage){
  try{
    const raw=storage.getItem(getSubjectStorageKey('administracao'));
    if(raw===null)return {ok:true,exists:false,state:null};
    const state=JSON.parse(raw);
    if(!obj(state)||!obj(state.progress))throw Error('Estado administrativo incompatível; dados preservados.');
    return {ok:true,exists:true,state};
  }catch(error){return {ok:false,exists:true,state:null,message:String(error.message||error)}};
}
export function summarizeSubjectProgress(state){
  const p=state?.progress??{};
  const lessons=Object.values(p.lessons??{}).filter(x=>x?.completed===true).length;
  const questions=Object.keys(p.questionHistory??{}).length;
  const answered=Object.values(p.questionHistory??{});
  const errorCount=answered.filter(x=>x&&x.lastCorrect===false).length;
  const diagnostics=Object.values(p.diagnostics??{}).filter(x=>x&&typeof x.rating==='string').length;
  return {lessons,questions,errorCount,diagnostics};
}
/** Atualiza UMA tentativa sem modificar respostas de outras questões. */
export function recordQuestion(state,question,selected,kind='banco'){
  if(!question||!Array.isArray(question.options)||!Number.isInteger(question.answer)||!Number.isInteger(selected)||selected<0||selected>=question.options.length)throw Error('Resposta inválida.');
  const bucket=kind==='exercicios'?'exercises':'questionHistory';
  const current=state.progress[bucket]?.[question.id]??{attempts:0,correct:0};
  const passed=question.answer===selected;
  return {...state,progress:{...state.progress,[bucket]:{
    ...state.progress[bucket],
    [question.id]:{attempts:(current.attempts??0)+1,correct:(current.correct??0)+(passed?1:0),lastAnswer:selected,lastCorrect:passed,updatedAt:new Date().toISOString()}
  }}};
}
export function recordDiagnostic(state,subtopicId,rating){
  if(!['sei','duvida','nao'].includes(rating))throw Error('Avaliação inválida.');
  return {...state,progress:{...state.progress,diagnostics:{...state.progress.diagnostics,[subtopicId]:{rating,updatedAt:new Date().toISOString()}}}};
}
export function markLessonComplete(state,subtopicId){
  return {...state,progress:{...state.progress,lessons:{...state.progress.lessons,[subtopicId]:{completed:true,updatedAt:new Date().toISOString()}}}};
}
export function recordFlashcard(state,cardId,rating){
  if(!['sei','duvida','nao'].includes(rating))throw Error('Avaliação inválida.');
  return {...state,progress:{...state.progress,flashcards:{...state.progress.flashcards,[cardId]:{rating,updatedAt:new Date().toISOString()}}}};
}
