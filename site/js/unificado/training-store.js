/** Armazenamento reutilizável por disciplina. Não escreve nas chaves antigas. */
import { TRAINING_KEY,createTrainingState,validateTrainingState } from './training-engine.js';
const SUBJECT=/^[a-z][a-z0-9-]{2,40}$/;
export function trainingKeyFor(subjectId){
  if(typeof subjectId!=='string'||!SUBJECT.test(subjectId))throw Error('Identificador de disciplina inválido.');
  return `estudoConcursos.v1.training.${subjectId}`;
}
export function createTrainingStore(subjectId){
  const key=trainingKeyFor(subjectId);
  function read(storage=globalThis.localStorage){
    try{
      const raw=storage.getItem(key);
      if(raw===null)return {ok:true,raw:null,state:createTrainingState(undefined,subjectId)};
      const state=validateTrainingState(JSON.parse(raw),subjectId);
      return {ok:true,raw,state};
    }catch(error){return {ok:false,message:`Histórico preservado; nenhuma gravação será feita. ${error.message}`};}
  }
  /** CAS otimista: verifica valor lido antes de escrever, evitando sobrescrita silenciosa. */
  function update(mutator,storage=globalThis.localStorage){
    const before=read(storage);if(!before.ok)return before;
    try{
      const state=JSON.parse(JSON.stringify(before.state));
      const result=mutator(state);
      validateTrainingState(state,subjectId);
      if(storage.getItem(key)!==before.raw)throw Error('Dados alterados em outra aba. Atualize a página antes de continuar.');
      state.metadata.updatedAt=new Date().toISOString();
      const serialized=JSON.stringify(state);
      storage.setItem(key,serialized);
      if(storage.getItem(key)!==serialized)throw Error('Gravação não confirmada.');
      return {ok:true,state,result};
    }catch(error){return {ok:false,message:String(error.message||error)};}
  }
  return {key,read,update};
}
// Adaptador de Administração nesta fase; demais disciplinas reutilizam a fábrica.
const admin=createTrainingStore('administracao');
if(admin.key!==TRAINING_KEY)throw Error('Chave administrativa incompatível.');
export const readTrainingState=admin.read;
export const updateTrainingState=admin.update;
