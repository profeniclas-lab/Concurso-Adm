/** Fase 5 — apenas estrutura e integridade. Não reavalia enunciados ou gabaritos. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {planLazyCatalog,writeLazyCatalog} from '../scripts/build-admin-lazy-catalog.mjs';
import {createAdminCatalogLoader} from '../site/js/unificado/admin-catalog.js';

const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const items=[
 {id:'Q-ADM-01-AAA',moduleId:'ADM-01',stem:'Exemplo de teste',options:['A','B'],answer:0},
 {id:'Q-DA-17-BBB',moduleId:'DA-17',stem:'Outra questão de teste',options:['C','D'],answer:1},
 {id:'Q-ADM-01-CCC',moduleId:'ADM-01',stem:'Mais uma de teste',options:['Sim','Não'],answer:1}
];
const modules=[{id:'ADM-01',title:'Fundamentos',area:'ADM'},{id:'DA-17',title:'Agentes Públicos',area:'DA'}];
const baseline={questionCount:3,fullDataSha256:sha(items),modules:[{id:'ADM-01',totalCount:2},{id:'DA-17',totalCount:1}]};

test('gera arquivos individuais somente com questões do respectivo módulo',()=>{
 const plan=planLazyCatalog(modules,items,baseline,{expectedTotal:3});
 assert.equal(plan.manifest.questionCount,3);
 assert.equal(plan.manifest.moduleCount,2);
 assert.deepEqual([...plan.files.keys()],['questoes/ADM-01.js','questoes/DA-17.js']);
 const group=plan.files.get('questoes/ADM-01.js');
 assert.match(group,/Q-ADM-01-AAA/);
 assert.doesNotMatch(group,/Q-DA-17-BBB/);
});
test('recusa divergência de quantidade, hashes, duplicidades e módulo ausente',()=>{
 assert.throws(()=>planLazyCatalog(modules,items,baseline,{expectedTotal:757}),/Quantidade incorreta/);
 assert.throws(()=>planLazyCatalog(modules,items,{...baseline,fullDataSha256:'errado'},{expectedTotal:3}),/SHA-256/);
 const duplicated=[items[0],items[0],items[1]];
 const wrong={...baseline,fullDataSha256:sha(duplicated)};
 assert.throws(()=>planLazyCatalog(modules,duplicated,wrong,{expectedTotal:3}),/duplicado/);
 const missing=modules.slice(0,1);
 assert.throws(()=>planLazyCatalog(missing,items,baseline,{expectedTotal:3}),/não foram atribuídas/);
});
test('escreve módulos em pasta isolada sem tocar nos arquivos de origem',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'estudo-fase05-'));
 try{
  const original=join(dir,'js','data','questions.js');
  mkdirSync(join(dir,'js','data'),{recursive:true});
  writeFileSync(join(dir,'package.json'),'{"type":"module"}');
  writeFileSync(original,'// marcador original que não pode mudar\n');
  const plan=planLazyCatalog(modules,items,baseline,{expectedTotal:3});
  await writeLazyCatalog(dir,plan);
  const got=JSON.parse(readFileSync(join(dir,'catalogo-leve','manifest.json'),'utf8'));
  assert.equal(got.moduleCount,2);
  assert.ok(existsSync(join(dir,'catalogo-leve','questoes','DA-17.js')));
  assert.equal(readFileSync(original,'utf8'),'// marcador original que não pode mudar\n');
 }finally{rmSync(dir,{recursive:true,force:true})}
});
const moduleIds=[...Array.from({length:12},(_,i)=>`ADM-${String(i+1).padStart(2,'0')}`),'AP-13','AP-14',...Array.from({length:13},(_,i)=>`DA-${String(i+15).padStart(2,'0')}`)];
const manifest={format:'estudo-concursos/admin-lazy-catalog/v1',questionCount:757,moduleCount:27,
 modules:moduleIds.map((id,index)=>({id,file:`questoes/${id}.js`,count:index?1:731,title:id}))};

test('carregamento sob demanda: manifesto uma vez, apenas módulo solicitado',async()=>{
 const imported=[];let fetched=0;
 const loader=createAdminCatalogLoader({
  fetcher:async()=>{fetched++;return {ok:true,json:async()=>manifest}},
  importer:async url=>{
   imported.push(url);const id=decodeURIComponent(url.split('/').at(-1).replace('.js',''));
   const count=manifest.modules.find(x=>x.id===id).count;
   return {QUESTIONS:Array.from({length:count},(_,i)=>({id:`Q-${id}-${i}`,moduleId:id,options:['A','B'],answer:0}))};
  }
 });
 await loader.catalog();
 assert.equal(imported.length,0,'Consultar lista não deve baixar questões');
 const a=await loader.moduleQuestions('DA-17');
 assert.equal(a.length,1);
 await loader.moduleQuestions('DA-17');
 assert.equal(imported.length,1,'Repetição deve usar cache do módulo');
 assert.equal(fetched,1,'Manifesto em cache');
 assert.equal((await loader.moduleQuestions('ADM-01')).length,731);
 assert.equal(imported.length,2);
 assert.ok(imported.every(x=>!x.includes('DA-18')));
 await assert.rejects(()=>loader.moduleQuestions('../../app.js'),/inválido/);
 assert.equal(imported.length,2);
});
test('não aceita manifesto ou questões tecnicamente inválidos',async()=>{
 const loader=createAdminCatalogLoader({
  fetcher:async()=>({ok:true,json:async()=>manifest}),
  importer:async()=>({QUESTIONS:[{id:'A',moduleId:'DA-17',options:['A'],answer:5}]})
 });
 await assert.rejects(()=>loader.moduleQuestions('DA-17'),/Questão inválida/);
 const wrong=createAdminCatalogLoader({fetcher:async()=>({ok:true,json:async()=>({...manifest,questionCount:756})})});
 await assert.rejects(()=>wrong.catalog(),/incompleto/);
});
test('integração no portal: navegação direta e consulta explicitamente sem gravação',async()=>{
 const app=readFileSync(new URL('../site/js/unificado/app.js',import.meta.url),'utf8');
 const build=readFileSync(new URL('../scripts/build-site.sh',import.meta.url),'utf8');
 assert.match(app,/admin-modulos/);
 assert.match(app,/admin-questoes/);
 assert.match(app,/Nenhuma resposta é registrada aqui/);
 assert.match(app,/loadAdminQuestions\(moduleId\)/);
 assert.match(build,/node scripts\/build-admin-lazy-catalog\.mjs dist\/administracao/);
});


test('escala prevista: 757 registros sintéticos distribuídos por 27 módulos',async()=>{
 const counts=moduleIds.map((_,i)=>i===0?731:1);
 const all=moduleIds.flatMap((moduleId,i)=>Array.from({length:counts[i]},(_,n)=>({
   id:`Q-${moduleId}-${n}`,moduleId,options:['A','B'],answer:n%2,stem:`Item sintético ${n}`
 })));
 const catalogModules=moduleIds.map(id=>({id,title:`Módulo ${id}`,area:id.split('-')[0]}));
 const snapshot={questionCount:757,fullDataSha256:sha(all),modules:moduleIds.map((id,i)=>({id,totalCount:counts[i]}))};
 const generated=planLazyCatalog(catalogModules,all,snapshot);
 const root=mkdtempSync(join(tmpdir(),'estudo-fase05-escala-'));
 try{
   writeFileSync(join(root,'package.json'),'{"type":"module"}');
   await writeLazyCatalog(root,generated);
   assert.equal(generated.files.size,27);
   assert.equal(generated.manifest.modules.reduce((n,m)=>n+m.count,0),757);
   assert.equal(generated.manifest.completeBankSha256,sha(all));
   assert.ok(readFileSync(join(root,'catalogo-leve','questoes','DA-27.js'),'utf8').includes('DA-27'));
 }finally{rmSync(root,{recursive:true,force:true})}
});
