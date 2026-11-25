import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {
 planSharedBundles,writeSharedBundles,SHARED_BUNDLE_FORMAT,SHARED_MANIFEST_FORMAT
} from '../scripts/build-admin-shared-bundles.mjs';
import {
 validateSharedModule,createSharedModuleLoader
} from '../site/js/unificado/shared-module-loader.js';
import {renderSharedModule} from '../site/js/unificado/shared-module-ui.js';

const root=new URL('../',import.meta.url).pathname;
const real=join(root,'dist/administracao');
const path=x=>join(real,x);
const source=async x=> (await import(pathToFileURL(path('js/data/'+x)).href));
const fixture=()=>({format:SHARED_BUNDLE_FORMAT,subjectId:'administracao',moduleId:'ADM-01',
  title:'Fundamentos de Administração',area:'ADM',questionCount:33,
  subtopics:[{id:'ADM-01-001',title:'Introdução'},{id:'ADM-01-002',title:'Recursos'}],
  lessons:{'ADM-01-001':{id:'ADM-01-001',objective:'Objetivo',concept:'Conceito',explanation:'Uma explicação',reviewQuestion:'Pergunta?',reviewAnswer:'Resposta.'},
    'ADM-01-002':{id:'ADM-01-002',concept:'Conceito 2'}},
  diagnostic:[{subtopicId:'ADM-01-001',front:'Frente 1',back:'Verso 1'},
    {subtopicId:'ADM-01-002',front:'Frente 2',back:'Verso 2'}]
});
const stubManifest=()=>({format:SHARED_MANIFEST_FORMAT,moduleCount:27,questionCount:757,
  modules:Array.from({length:27},(_,i)=>({id:i<12?`ADM-${String(i+1).padStart(2,'0')}`:i<14?`AP-${i+1}`:`DA-${i+1}`,
   file:`modulos/${i<12?'ADM':i<14?'AP':'DA'}-${String(i+1).padStart(2,'0')}.js`,questionCount:i===0?33:i<=22?28:27,
   lessonCount:2,diagnosticCount:2}))});

test('contrato do motor compartilhado aceita aula e diagnóstico válidos',()=>{
 assert.equal(validateSharedModule(fixture(),'administracao','ADM-01').questionCount,33);
});
test('contrato bloqueia disciplina ou módulo trocado',()=>{
 assert.throws(()=>validateSharedModule(fixture(),'portugues','ADM-01'),/incompatível/);
 assert.throws(()=>validateSharedModule(fixture(),'administracao','ADM-02'),/incompatível/);
});
test('contrato bloqueia subtópicos e cartões duplicados',()=>{
 const b=fixture();b.diagnostic[1].subtopicId=b.diagnostic[0].subtopicId;
 assert.throws(()=>validateSharedModule(b,'administracao','ADM-01'),/repetido/);
});
test('adaptador ignora tentativas de carregar módulos com nomes não reconhecidos',async()=>{
 const load=createSharedModuleLoader({fetcher:()=>{throw Error('Não deveria acessar rede.')}});
 await assert.rejects(()=>load.load('administracao','../ADM-01'),/inválido/);
 await assert.rejects(()=>load.load('outra-materia','ADM-01'),/inválido/);
});
test('adaptador só baixa o manifesto e o módulo solicitado, com cache de promessas',async()=>{
 const m=stubManifest();let fetches=0,imports=[];
 const loader=createSharedModuleLoader({fetcher:async()=>{fetches++;return {ok:true,json:async()=>m}},
   importer:async url=>{imports.push(url);return {default:fixture()}}});
 const [a,b]=await Promise.all([loader.load('administracao','ADM-01'),loader.load('administracao','ADM-01')]);
 assert.equal(a,b);assert.equal(fetches,1);assert.equal(imports.length,1);
 assert.match(imports[0],/modulos\/ADM-01\.js$/);
});
test('erro temporário elimina o cache e permite nova tentativa',async()=>{
 const m=stubManifest();let count=0;
 const loader=createSharedModuleLoader({fetcher:async()=>({ok:true,json:async()=>m}),
 importer:async()=>{if(++count===1)throw Error('Falha de rede');return {default:fixture()}}});
 await assert.rejects(loader.load('administracao','ADM-01'),/Falha de rede/);
 assert.equal((await loader.load('administracao','ADM-01')).moduleId,'ADM-01');
 assert.equal(count,2);
});
test('ausência de módulo no manifesto não importa arquivos arbitrários',async()=>{
 const loader=createSharedModuleLoader({fetcher:async()=>({ok:true,json:async()=>stubManifest()}),
 importer:async()=>{throw Error('import indevido')}});
 await assert.rejects(()=>loader.load('administracao','DA-99'),/não encontrado/);
});
test('renderização do índice é informativa e não grava armazenamento',async()=>{
 let writes=0;globalThis.localStorage={setItem:()=>{writes++},removeItem:()=>{writes++},getItem:()=>null};
 const el={innerHTML:''};const copy=structuredClone(fixture());
 await renderSharedModule(['estudo','administracao','ADM-01'],el,()=>true,async()=>copy);
 assert.match(el.innerHTML,/Fundamentos de Administração/);
 assert.match(el.innerHTML,/Aulas por subtópico/);
 assert.doesNotMatch(el.innerHTML,/>Ler aula<\/a>/);
 assert.match(el.innerHTML,/Diagnóstico/);
 assert.match(el.innerHTML,/Aproveitamento do módulo/);
 assert.equal(writes,0);assert.deepEqual(copy,fixture());delete globalThis.localStorage;
});
test('renderização de aula mostra objetivo, resumo e pergunta sem alterar conteúdo',async()=>{
 const el={innerHTML:''};
 await renderSharedModule(['estudo','administracao','ADM-01','aula','1'],el,()=>true,async()=>fixture());
 assert.match(el.innerHTML,/Uma explicação/);assert.match(el.innerHTML,/Recuperação ativa/);
 assert.match(el.innerHTML,/Próxima aula/);assert.match(el.innerHTML,/Voltar ao módulo/);
});
test('renderização de diagnóstico mantém a resposta em details',async()=>{
 const el={innerHTML:''};
 await renderSharedModule(['estudo','administracao','ADM-01','diagnostico','1'],el,()=>true,async()=>fixture());
 assert.match(el.innerHTML,/<details/);assert.match(el.innerHTML,/Verso 1/);
});
test('rota inválida não revela conteúdo e não há gravações',async()=>{
 const el={innerHTML:'anterior'};
 await assert.rejects(()=>renderSharedModule(['estudo','administracao','ADM-01','aula','500'],el,()=>true,async()=>fixture()),/inválida/);
 assert.equal(el.innerHTML,'anterior');
});
test('mudança de rota durante carregamento cancela a apresentação',async()=>{
 const el={innerHTML:'preservado'};
 await renderSharedModule(['estudo','administracao','ADM-01'],el,()=>false,async()=>fixture());
 assert.equal(el.innerHTML,'preservado');
});
test('portal e telas de módulos incluem a nova rota nativa sem substituir treino antigo',()=>{
 const root=new URL('../',import.meta.url).pathname;
 const app=readFileSync(join(root,'site/js/unificado/app.js'),'utf8');
 const ui=readFileSync(join(root,'site/js/unificado/admin-training-ui.js'),'utf8');
 const build=readFileSync(join(root,'scripts/build-site.sh'),'utf8');
 assert.match(app,/if\(route\[0\]==='estudo'\)/);
 assert.match(ui,/estudo\/administracao\/\$\{x\.id\}/);
 assert.match(ui,/treino-admin\/banco\/\$\{x\.id\}/);
 assert.match(build,/node scripts\/build-admin-shared-bundles\.mjs dist\/administracao/);
});
