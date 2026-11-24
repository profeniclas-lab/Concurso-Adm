/**
 * ESTUDO-CONCURSOS — Fase 8B.
 * Registro de atividades comuns, separado do ADM-ESTUDO, da cópia F7C e do treino F6.
 * Chave exclusiva por disciplina; sem qualquer escrita no estado antigo.
 */
export const SHARED_ACTIVITY_FORMAT='estudo-concursos/shared-activities/v1';
export const SHARED_ACTIVITY_VERSION=1;
export const ADMIN_SHARED_ACTIVITY_KEY='estudoConcursos.v1.shared-activities.administracao';
const MODULE=/^[A-Z]{2,5}-\d{2,3}$/;
const TOPIC=/^([A-Z]{2,5}-\d{2,3})-\d{3}$/;
const SUBJECT=/^[a-z][a-z0-9-]{2,40}$/;
const ratings=new Set(['sei','duvida','nao']);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const has=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const iso=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));

export function sharedActivityKey(subjectId){
 if(!SUBJECT.test(subjectId))throw Error('Disciplina inválida para atividades compartilhadas.');
 return `estudoConcursos.v1.shared-activities.${subjectId}`;
}
export function createSharedActivityState(subjectId,{now=new Date().toISOString()}={}){
 sharedActivityKey(subjectId);
 if(!iso(now))throw Error('Data inválida.');
 return {format:SHARED_ACTIVITY_FORMAT,schemaVersion:SHARED_ACTIVITY_VERSION,subjectId,
  baseline:null,metadata:{createdAt:now,updatedAt:null},diagnostics:{},lessons:{}};
}
export function validateSharedActivityState(state,subjectId){
 if(!obj(state)||state.format!==SHARED_ACTIVITY_FORMAT||state.schemaVersion!==SHARED_ACTIVITY_VERSION||
   state.subjectId!==subjectId||!obj(state.metadata)||!iso(state.metadata.createdAt)||
   !(state.metadata.updatedAt===null||iso(state.metadata.updatedAt))||
   !obj(state.diagnostics)||!obj(state.lessons)||
   !(state.baseline===null||obj(state.baseline)))throw Error('Histórico das atividades compartilhadas incompatível. Nenhum dado será substituído.');
 if(state.baseline){
   if(!['imported','legacy','none'].includes(state.baseline.source)||
     typeof state.baseline.digest!=='string'||!/^([0-9a-f]{64}|none)$/.test(state.baseline.digest)||
     (state.baseline.source==='none')!==(state.baseline.digest==='none'))
     throw Error('A referência de origem do histórico está incompatível.');
 }
 for(const [moduleId,entry] of Object.entries(state.diagnostics)){
   if(!MODULE.test(moduleId)||!obj(entry)||!obj(entry.answers))throw Error('Registro diagnóstico inválido.');
   for(const [topicId,choice] of Object.entries(entry.answers)){
     if(TOPIC.exec(topicId)?.[1]!==moduleId||!ratings.has(choice))throw Error('Resposta diagnóstica inválida.');
   }
 }
 for(const [topicId,item] of Object.entries(state.lessons)){
   if(!TOPIC.test(topicId)||!obj(item)||
     !(item.completed===undefined||item.completed===true)||
     !(item.rating===undefined||ratings.has(item.rating))||
     (item.completed!==true&&!ratings.has(item.rating)))throw Error('Registro de aula inválido.');
 }
 return state;
}
export function readSharedActivityState(subjectId,storage=globalThis.localStorage){
 const key=sharedActivityKey(subjectId);
 try{
   if(!storage||typeof storage.getItem!=='function')return {ok:true,exists:false,raw:null,state:createSharedActivityState(subjectId)};
   const raw=storage.getItem(key);
   if(raw===null)return {ok:true,exists:false,raw,state:createSharedActivityState(subjectId)};
   return {ok:true,exists:true,raw,state:validateSharedActivityState(JSON.parse(raw),subjectId)};
 }catch(error){return {ok:false,message:`Atividades preservadas, gravação bloqueada: ${error.message}`};}
}
export const hasSharedActivity=x=>!!x&&(Object.keys(x.diagnostics??{}).length>0||Object.keys(x.lessons??{}).length>0);
/** SHA-256 da cópia exata da fonte; evita vincular respostas novas a outra versão. */
export async function fingerprintBaseline({source,raw}){
 if(source==='none'&&raw===null)return {source,digest:'none'};
 if(!['imported','legacy'].includes(source)||typeof raw!=='string')throw Error('Fonte pedagógica inválida.');
 if(!globalThis.crypto?.subtle)throw Error('Ambiente sem verificação criptográfica da origem; salvamento bloqueado.');
 const bytes=new TextEncoder().encode(raw);
 const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
 return {source,digest:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('')};
}
export const sameBaseline=(a,b)=>a?.source===b?.source&&a?.digest===b?.digest;

/** Validação de permissões baseada no bundle, não nos valores enviados pelo botão. */
export function applySharedActivity(state,bundle,{kind,topicId,rating}={}){
 validateSharedActivityState(state,bundle.subjectId);
 const moduleId=bundle.moduleId;
 if(!MODULE.test(moduleId)||TOPIC.exec(topicId)?.[1]!==moduleId||
   !bundle.subtopics.some(x=>x.id===topicId))throw Error('Subtópico não pertence ao módulo.');
 if(kind==='diagnostic'){
   if(!ratings.has(rating)||!bundle.diagnostic.some(x=>x.subtopicId===topicId))throw Error('Autoavaliação diagnóstica inválida.');
   const entry=state.diagnostics[moduleId]??={answers:{}};
   entry.answers[topicId]=rating;
 }else if(kind==='lesson-complete'){
   if(!Object.hasOwn(bundle.lessons,topicId))throw Error('Aula indisponível.');
   const entry=state.lessons[topicId]??={};entry.completed=true;
 }else if(kind==='lesson-rating'){
   if(!ratings.has(rating)||!Object.hasOwn(bundle.lessons,topicId))throw Error('Autoavaliação de aula inválida.');
   const entry=state.lessons[topicId]??={};entry.rating=rating;
 }else throw Error('Atividade não reconhecida.');
 return state;
}

/**
 * Controle de concorrência: compara a chave nova e a referência antiga ANTES de gravar.
 * Não confunde atualizações na cópia F7C com progresso novo.
 */
export async function saveSharedActivity(subjectId,bundle,action,{
 storage=globalThis.localStorage,baselineReader,now=new Date().toISOString()
}={}){
 try{
  if(!storage?.getItem||!storage?.setItem||typeof baselineReader!=='function'||!iso(now))throw Error('Armazenamento, origem ou data inválidos.');
  if(bundle.subjectId!==subjectId)throw Error('Disciplina não corresponde ao módulo.');
  const current=readSharedActivityState(subjectId,storage);
  if(!current.ok)throw Error(current.message);
  const source=baselineReader(storage);
  const signature=await fingerprintBaseline(source);
  if(current.state.baseline&&!sameBaseline(current.state.baseline,signature))
    throw Error('A fonte pedagógica mudou desde a primeira atividade no novo motor. Preserve o backup e reconcilie o histórico antes de continuar.');
  const next=JSON.parse(JSON.stringify(current.state));
  applySharedActivity(next,bundle,action);
  next.baseline??=signature;
  next.metadata.updatedAt=now;
  validateSharedActivityState(next,subjectId);
  const key=sharedActivityKey(subjectId);
  if(storage.getItem(key)!==current.raw)throw Error('Atividades alteradas em outra aba. Atualize antes de responder.');
  const latest=baselineReader(storage);
  // Compara os dados brutos; bloqueia mudanças durante o cálculo do fingerprint.
  if(latest.source!==source.source||latest.raw!==source.raw)throw Error('O histórico de origem foi alterado em outra aba. Recarregue a página.');
  // Releitura síncrona após o callback: evita alteração ocorrida DURANTE a
  // segunda consulta (inclusive em testes com storage instrumentado).
  const originKey=source.source==='imported'?'estudoConcursos.v1.pedagogy.administracao':
    source.source==='legacy'?'admEstudo.v2.state':null;
  if(storage.getItem(key)!==current.raw||
    (originKey!==null&&storage.getItem(originKey)!==source.raw)||
    (source.source==='none'&&
      (storage.getItem('admEstudo.v2.state')!==null||storage.getItem('estudoConcursos.v1.pedagogy.administracao')!==null)))
    throw Error('A origem ou as atividades foram alteradas em outra aba. Recarregue a página.');
  const serialized=JSON.stringify(next);
  storage.setItem(key,serialized);
  if(storage.getItem(key)!==serialized)throw Error('Não foi possível confirmar o salvamento.');
  return {ok:true,state:next};
 }catch(error){return {ok:false,message:String(error.message||error)};}
}
