import {assertKnownSubject,getSubjectByModuleId} from './subjects.js';
const catalogCache=new Map();
export function validateBundle(bundle, expectedModuleId){
  const errors=[];const data=bundle?.default??bundle;
  if(!data||typeof data!=='object'||Array.isArray(data))return {ok:false,errors:['Pacote deve ser objeto.']};
  if(data.moduleId!==expectedModuleId)errors.push('moduleId incompatível.');
  if(!data.lessons||typeof data.lessons!=='object'||Array.isArray(data.lessons))errors.push('lessons deve ser objeto.');
  for(const kind of ['diagnostic','exercises','questions','flashcards'])if(!Array.isArray(data[kind]))errors.push(`${kind} deve ser array.`);
  const all=new Set();
  for(const kind of ['exercises','questions'])for(const q of (Array.isArray(data[kind])?data[kind]:[])){
    if(typeof q?.id!=='string'||!q.id.trim())errors.push(`${kind}: questão sem ID.`);
    else if(all.has(q.id))errors.push(`ID duplicado: ${q.id}`);
    else all.add(q.id);
    if(q?.moduleId!==expectedModuleId)errors.push(`Questão fora do módulo: ${q?.id??'sem ID'}`);
    if(!Array.isArray(q?.options)||q.options.length<2||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length)errors.push(`Gabarito ou opções inválidos: ${q?.id??'sem ID'}`);
  }
  return {ok:errors.length===0, errors};
}
/** A função de importação é injetável para testes. */
export function createModuleLoader(importer=(subjectId,moduleId)=>import(`./content/${subjectId}/${moduleId}/index.js`)){
  const cache=new Map();
  return async (subjectId,moduleId)=>{
    const subject=assertKnownSubject(subjectId);
    if(subject.status!=='ready')throw new Error('Use o adaptador de Administração durante a transição.');
    if(typeof moduleId!=='string'||!/^[A-Z]{2,5}-\d{2,3}$/.test(moduleId)||getSubjectByModuleId(moduleId)?.id!==subject.id)throw new Error('Módulo inválido para a disciplina.');
    const key=`${subjectId}:${moduleId}`;
    if(!cache.has(key))cache.set(key,Promise.resolve().then(()=>importer(subjectId,moduleId)).then(result=>{
      const bundle=result?.default??result;const valid=validateBundle(bundle,moduleId);
      if(!valid.ok)throw new Error(valid.errors.join(' '));return bundle;
    }).catch(error=>{cache.delete(key);throw error}));
    return cache.get(key);
  };
}
export const loadModule=createModuleLoader();
export async function loadSubjectCatalog(subjectId){
  const subject=assertKnownSubject(subjectId);
  if(subject.status!=='ready')throw new Error('O catálogo de Administração utiliza o motor original.');
  if(!catalogCache.has(subjectId))catalogCache.set(subjectId,import(`./content/${subjectId}/modules.js`).then(mod=>{
    if(!Array.isArray(mod.MODULES))throw new Error('Catálogo sem MODULES.');
    const ids=new Set();
    for(const m of mod.MODULES){
      if(!m||typeof m.id!=='string'||!Array.isArray(m.subtopics)||getSubjectByModuleId(m.id)?.id!==subjectId)throw new Error('Módulo inválido no catálogo.');
      if(ids.has(m.id))throw new Error(`Módulo duplicado ${m.id}`);ids.add(m.id);
    }
    return {subject,modules:mod.MODULES,areas:mod.AREAS??{}};
  }).catch(error=>{catalogCache.delete(subjectId);throw error}));
  return catalogCache.get(subjectId);
}
