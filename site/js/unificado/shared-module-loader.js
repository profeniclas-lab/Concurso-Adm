/** Contrato comum de módulo: Administração por arquivos gerados, demais disciplinas por módulos ES. */
import {getSubject} from './subjects.js';
import {loadModule,loadSubjectCatalog} from './loader.js';
export const SHARED_MODULE_FORMAT='estudo-concursos/shared-module/v1';
export const SHARED_MANIFEST_FORMAT='estudo-concursos/shared-module-manifest/v1';
const MODULE_ID=/^[A-Z]{2,5}-\d{2,3}$/;
const adminRoot=new URL('../../administracao/catalogo-leve/motor-unificado/',import.meta.url);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

export function validateSharedModule(bundle,subjectId,moduleId){
 const b=bundle?.default??bundle;
 if(!obj(b)||b.format!==SHARED_MODULE_FORMAT||b.moduleId!==moduleId||b.subjectId!==subjectId||
   typeof b.title!=='string'||!Array.isArray(b.subtopics)||!obj(b.lessons)||!Array.isArray(b.diagnostic))
   throw Error('Módulo incompatível com o motor compartilhado.');
 const ids=new Set();
 for(const t of b.subtopics){
   if(!obj(t)||typeof t.id!=='string'||!t.id.startsWith(moduleId+'-')||typeof t.title!=='string'||ids.has(t.id))
     throw Error('Subtópicos inválidos ou duplicados.');
   ids.add(t.id);
 }
 for(const [id,lesson] of Object.entries(b.lessons)){
   if(!ids.has(id)||!obj(lesson))throw Error('Aula fora do módulo.');
 }
 const cards=new Set();
 for(const c of b.diagnostic){
   if(!obj(c)||!ids.has(c.subtopicId)||cards.has(c.subtopicId)||typeof c.front!=='string'||typeof c.back!=='string')
      throw Error('Diagnóstico inválido ou repetido.');
   cards.add(c.subtopicId);
 }
 return b;
}
export function createSharedModuleLoader({
 fetcher=url=>fetch(url,{cache:'no-store'}),
 importer=url=>import(url),
 regularCatalog=loadSubjectCatalog,
 regularModule=loadModule
}={}){
 const cache=new Map();let adminManifestPromise=null;
 async function adminManifest(){
   if(!adminManifestPromise)adminManifestPromise=Promise.resolve().then(async()=>{
     const r=await fetcher(new URL('manifest.json',adminRoot).href);
     if(!r?.ok)throw Error('Catálogo do motor unificado ainda não foi publicado.');
     const m=await r.json();
     if(m?.format!==SHARED_MANIFEST_FORMAT||m.moduleCount!==27||m.questionCount!==757||
       !Array.isArray(m.modules)||m.modules.length!==27)throw Error('Manifesto compartilhado incompleto.');
     const ids=new Set();let total=0;
     for(const x of m.modules){
       if(!MODULE_ID.test(x?.id)||ids.has(x.id)||x.file!==`modulos/${x.id}.js`||
          !Number.isInteger(x.questionCount)||x.questionCount<1)throw Error('Entrada inválida no manifesto.');
       ids.add(x.id);total+=x.questionCount;
     }
     if(total!==757)throw Error('Catálogo não preserva 757 questões.');
     return m;
   }).catch(e=>{adminManifestPromise=null;throw e});
   return adminManifestPromise;
 }
 async function load(subjectId,moduleId){
   if(!getSubject(subjectId)||!MODULE_ID.test(moduleId))throw Error('Disciplina ou módulo inválido.');
   const key=`${subjectId}:${moduleId}`;
   if(!cache.has(key))cache.set(key,Promise.resolve().then(async()=>{
     if(subjectId==='administracao'){
       const m=await adminManifest();const entry=m.modules.find(x=>x.id===moduleId);
       if(!entry)throw Error('Módulo administrativo não encontrado.');
       const bundle=validateSharedModule(await importer(new URL(entry.file,adminRoot).href),subjectId,moduleId);
       if(bundle.subtopics.length!==entry.lessonCount||bundle.diagnostic.length!==entry.diagnosticCount||bundle.questionCount!==entry.questionCount)
          throw Error('Módulo não corresponde ao manifesto aprovado.');
       return bundle;
     }
     const catalog=await regularCatalog(subjectId);
     const metadata=catalog.modules.find(x=>x.id===moduleId);
     if(!metadata)throw Error('Módulo não cadastrado para a disciplina.');
     const content=await regularModule(subjectId,moduleId);
     const adapted={format:SHARED_MODULE_FORMAT,subjectId,moduleId,title:metadata.title,
       area:moduleId.split('-')[0],subtopics:metadata.subtopics,
       lessons:content.lessons,diagnostic:content.diagnostic,questionCount:content.questions.length};
     return validateSharedModule(adapted,subjectId,moduleId);
   }).catch(e=>{cache.delete(key);throw e}));
   return cache.get(key);
 }
 return {load,adminManifest};
}
const loader=createSharedModuleLoader();
export const loadSharedModule=loader.load;
export const loadSharedAdminManifest=loader.adminManifest;
