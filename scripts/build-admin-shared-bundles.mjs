/** Fase 8A — adaptador do conteúdo original, sem alteração pedagógica.
 * Executar SOMENTE depois da geração dos catálogos Fases 5 e 7C, sobre dist/.
 * Produz 27 módulos leves (aulas e diagnóstico); questões permanecem no catálogo F5.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {deepStrictEqual} from 'node:assert/strict';

export const SHARED_BUNDLE_FORMAT='estudo-concursos/shared-module/v1';
export const SHARED_MANIFEST_FORMAT='estudo-concursos/shared-module-manifest/v1';
const sha256=x=>createHash('sha256').update(x).digest('hex');
const pattern=/^(ADM|AP|DA)-\d{2}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);

export function planSharedBundles(modules,lessons,diagnostics,pedagogyIndex,questionManifest){
  if(!Array.isArray(modules)||modules.length!==27||!object(lessons)||!object(diagnostics)||
     !Array.isArray(pedagogyIndex?.modules)||pedagogyIndex.modules.length!==27||
     !Array.isArray(questionManifest?.modules)||questionManifest.modules.length!==27||
     pedagogyIndex.questionCount!==757||questionManifest.questionCount!==757||
     pedagogyIndex.catalogSha256!==questionManifest.completeBankSha256)
    throw Error('Fase 8A: índices administrativos divergentes; publicação bloqueada.');
  const moduleIds=new Set();const allTopicIds=new Set();const files=new Map(),entries=[];
  for(const mod of modules){
    if(!pattern.test(mod?.id)||moduleIds.has(mod.id)||!Array.isArray(mod.subtopics)||!mod.subtopics.length||
       typeof mod.title!=='string'||!mod.title.trim())throw Error('Módulo original inválido ou duplicado.');
    moduleIds.add(mod.id);
    const pi=pedagogyIndex.modules.find(m=>m.id===mod.id),
      qi=questionManifest.modules.find(m=>m.id===mod.id);
    if(!pi||!qi||pi.title!==mod.title||qi.count!==pi.bank.length||
       pi.subtopicIds.length!==mod.subtopics.length)
      throw Error(`Metadados divergentes para ${mod.id}.`);
    const subtopics=mod.subtopics.map(t=>{
      if(!t||typeof t.id!=='string'||!t.id.startsWith(mod.id+'-')||
         typeof t.title!=='string'||allTopicIds.has(t.id))throw Error(`Subtópico inválido em ${mod.id}.`);
      allTopicIds.add(t.id);return t;
    });
    const cards=diagnostics[mod.id];
    if(!Array.isArray(cards)||cards.length!==subtopics.length ||
       new Set(cards.map(c=>c.subtopicId)).size!==subtopics.length||
       subtopics.some(t=>!cards.some(c=>c.subtopicId===t.id)))
      throw Error(`Diagnóstico não corresponde aos subtópicos em ${mod.id}.`);
    const copyLessons={};
    for(const t of subtopics){
      if(!object(lessons[t.id])||lessons[t.id].id!==t.id)throw Error(`Aula indisponível: ${t.id}.`);
      copyLessons[t.id]=lessons[t.id];
    }
    const bundle={format:SHARED_BUNDLE_FORMAT,subjectId:'administracao',moduleId:mod.id,
      title:mod.title,area:mod.area,subtopics,lessons:copyLessons,
      diagnostic:subtopics.map(t=>cards.find(c=>c.subtopicId===t.id)),
      questionCount:qi.count};
    const file=`modulos/${mod.id}.js`;
    const json=JSON.stringify(bundle);
    files.set(file,`/** Gerado da fonte administrativa validada; não editar manualmente. */\nexport default ${JSON.stringify(bundle,null,2)};\n`);
    entries.push({id:mod.id,file,lessonCount:subtopics.length,diagnosticCount:cards.length,
      questionCount:qi.count,dataSha256:sha256(json)});
  }
  if(entries.reduce((n,x)=>n+x.questionCount,0)!==757)
    throw Error('Fase 8A: total de questões mudou.');
  return {files,manifest:{format:SHARED_MANIFEST_FORMAT,subjectId:'administracao',moduleCount:27,
    questionCount:757,sourceCatalogSha256:pedagogyIndex.catalogSha256,modules:entries}};
}

export async function writeSharedBundles(root,plan){
 const dir=join(root,'catalogo-leve','motor-unificado');
 mkdirSync(join(dir,'modulos'),{recursive:true});
 for(const [file,source] of plan.files)writeFileSync(join(dir,file),source,'utf8');
 writeFileSync(join(dir,'manifest.json'),JSON.stringify(plan.manifest,null,2)+'\n','utf8');
 for(const item of plan.manifest.modules){
   const imported=await import(pathToFileURL(join(dir,item.file)).href);
   if(sha256(JSON.stringify(imported.default))!==item.dataSha256)throw Error(`Bundle divergente: ${item.id}`);
 }
 return dir;
}
async function main(){
 const root=resolve(process.argv[2]??'');
 if(!process.argv[2]||!/(?:^|[\\/])dist[\\/]administracao$/.test(root))
    throw Error('Por segurança, o gerador só aceita dist/administracao.');
 const data=join(root,'js/data');
 const [{MODULES},{LESSONS},{DIAGNOSTICS}]=await Promise.all([
  import(pathToFileURL(join(data,'modules.js')).href),
  import(pathToFileURL(join(data,'lessons.js')).href),
  import(pathToFileURL(join(data,'diagnostics.js')).href)
 ]);
 const index=JSON.parse(readFileSync(join(root,'catalogo-leve/pedagogia-index.json'),'utf8'));
 const bank=JSON.parse(readFileSync(join(root,'catalogo-leve/manifest.json'),'utf8'));
 const plan=planSharedBundles(MODULES,LESSONS,DIAGNOSTICS,index,bank);
 await writeSharedBundles(root,plan);
 for(const m of MODULES){
    const bundle=(await import(pathToFileURL(join(root,'catalogo-leve/motor-unificado/modulos',m.id+'.js')).href)).default;
    deepStrictEqual(bundle.subtopics,m.subtopics);
    deepStrictEqual(bundle.diagnostic,m.subtopics.map(t=>DIAGNOSTICS[m.id].find(c=>c.subtopicId===t.id)));
    for(const t of m.subtopics)deepStrictEqual(bundle.lessons[t.id],LESSONS[t.id]);
 }
 console.log('Fase 8A: 27 módulos, aulas e diagnósticos preservados; 757 questões referenciadas sem duplicação.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(e=>{console.error('[Fase 8A]',e.message);process.exitCode=1});
