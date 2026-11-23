import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {SUBJECTS,getSubject,getSubjectByModuleId} from '../site/js/unificado/subjects.js';
import {getSubjectStorageKey,UNIFIED_UI_STORAGE_KEY,EXISTING_ADM_KEY} from '../site/js/unificado/storage-keys.js';
import {makeModuleBundle} from '../site/js/unificado/content-contract.js';
import {validateBundle,createModuleLoader,loadSubjectCatalog} from '../site/js/unificado/loader.js';
import {createSubjectProgress,readAdminProgress,readSubjectProgress,saveSubjectProgress,recordQuestion,recordDiagnostic,markLessonComplete,summarizeSubjectProgress} from '../site/js/unificado/progress-store.js';

class MemoryStorage{
  constructor(){this.map=new Map()}
  getItem(k){return this.map.has(k)?this.map.get(k):null}
  setItem(k,v){this.map.set(k,String(v))}
}
const base=join(import.meta.dirname,'..');

test('cinco disciplinas distintas com áreas exclusivas',()=>{
  assert.equal(SUBJECTS.length,5);
  assert.equal(new Set(SUBJECTS.map(x=>x.id)).size,5);
  const areas=SUBJECTS.flatMap(x=>x.areas);
  assert.equal(new Set(areas).size,areas.length);
  assert.equal(getSubjectByModuleId('DA-17').id,'administracao');
  assert.equal(getSubjectByModuleId('POR-01').id,'portugues');
  assert.equal(getSubjectByModuleId('CON-05').id,'constitucional');
  assert.equal(getSubjectByModuleId('???'),null);
  assert.equal(getSubject('invalid'),null);
});
test('namespaces separados, preserva a chave de Administração',()=>{
  assert.equal(getSubjectStorageKey('administracao'),EXISTING_ADM_KEY);
  assert.equal(EXISTING_ADM_KEY,'admEstudo.v2.state');
  assert.equal(getSubjectStorageKey('portugues'),'estudoConcursos.v1.subject.portugues');
  assert.notEqual(getSubjectStorageKey('portugues'),getSubjectStorageKey('matematica'));
  assert.notEqual(UNIFIED_UI_STORAGE_KEY,EXISTING_ADM_KEY);
});
test('leitura do progresso de ADM é somente leitura, não regrava',()=>{
  const storage=new MemoryStorage();const content=JSON.stringify({schemaVersion:3,progress:{lessons:{},questionHistory:{}}});
  storage.setItem(EXISTING_ADM_KEY,content);
  const r=readAdminProgress(storage);
  assert.equal(r.ok,true);assert.equal(r.exists,true);
  assert.equal(storage.getItem(EXISTING_ADM_KEY),content);
  assert.throws(()=>createSubjectProgress('administracao'));
  assert.equal(saveSubjectProgress('administracao',null,{schemaVersion:1},storage).ok,false);
});
test('estado novo é criado apenas em memória até primeira atividade',()=>{
  const storage=new MemoryStorage();const r=readSubjectProgress('portugues',storage);
  assert.equal(r.ok,true);assert.equal(r.raw,null);
  assert.equal(storage.map.size,0);
  assert.equal(r.state.subjectId,'portugues');
});
test('mudança concorrente impede sobrescrever progresso',()=>{
  const storage=new MemoryStorage();const init=readSubjectProgress('portugues',storage);
  const done=saveSubjectProgress('portugues',init.raw,markLessonComplete(init.state,'POR-01-001'),storage);
  assert.equal(done.ok,true);
  assert.equal(saveSubjectProgress('portugues',init.raw,init.state,storage).ok,false);
  assert.equal(readSubjectProgress('portugues',storage).state.progress.lessons['POR-01-001'].completed,true);
});
test('estado incompatível é bloqueado e preservado',()=>{
  const storage=new MemoryStorage();const key=getSubjectStorageKey('matematica');storage.setItem(key,'{"schemaVersion":999}');
  const read=readSubjectProgress('matematica',storage);
  assert.equal(read.ok,false);
  assert.equal(storage.getItem(key),'{"schemaVersion":999}');
});
test('registro de aula, diagnóstico e questões não mistura disciplinas',()=>{
  const storage=new MemoryStorage();const original=createSubjectProgress('portugues');
  const question={id:'Q-POR-01-001',moduleId:'POR-01',options:['A','B'],answer:1};
  const state=recordQuestion(recordDiagnostic(markLessonComplete(original,'POR-01-001'),'POR-01-001','sei'),question,1);
  const result=saveSubjectProgress('portugues',null,state,storage);
  assert.equal(result.ok,true);
  assert.deepEqual(summarizeSubjectProgress(result.state),{lessons:1,questions:1,errorCount:0,diagnostics:1});
  assert.equal(readSubjectProgress('matematica',storage).state.progress.lessons['POR-01-001'],undefined);
  assert.equal(storage.getItem(EXISTING_ADM_KEY),null);
});
test('contrato valida ID, opções e gabarito (sem revisar matéria ADM)',()=>{
  const valid=makeModuleBundle({moduleId:'POR-01',questions:[{id:'Q-POR-01-001',moduleId:'POR-01',stem:'Exemplo de fixture',options:['a','b'],answer:1}]});
  assert.equal(validateBundle(valid,'POR-01').ok,true);
  const bad=makeModuleBundle({moduleId:'POR-01',questions:[{id:'Q-POR-01-001',moduleId:'POR-02',options:['A'],answer:1}]});
  assert.equal(validateBundle(bad,'POR-01').ok,false);
  assert.equal(validateBundle({...valid,questions:[...valid.questions,...valid.questions]},'POR-01').ok,false);
});
test('carregador sob demanda armazena pacotes em cache',async()=>{
  let calls=0;const importer=async()=>{calls++;return {default:makeModuleBundle({moduleId:'POR-01',questions:[]})}};
  const loader=createModuleLoader(importer);
  const a=await loader('portugues','POR-01'),b=await loader('portugues','POR-01');
  assert.equal(a,b);assert.equal(calls,1);
  await assert.rejects(()=>loader('portugues','DA-17'));
  await assert.rejects(()=>loader('administracao','ADM-01'));
});
test('catálogos das novas disciplinas começam vazios e sem conteúdo fictício',async()=>{
  for(const s of SUBJECTS.filter(x=>x.id!=='administracao')){
    const catalog=await loadSubjectCatalog(s.id);
    assert.equal(catalog.modules.length,0);
    assert.equal(Object.keys(catalog.areas).length>0,true);
  }
});
test('HTML de inicialização aponta para motor unificado',()=>{
  const html=readFileSync(join(base,'site/index.html'),'utf8');
  assert.match(html,/js\/unificado\/app\.js/);
  assert.ok(existsSync(join(base,'site/css/app.css')));
  assert.match(readFileSync(join(base,'scripts/build-site.sh'),'utf8'),/dist\/administracao/);
  assert.ok(existsSync(join(base,'.github/workflows/pages.yml')));
});
test('novo pacote mantém conteúdo modular e não cria arquivo gigante de questões',()=>{
  for(const s of SUBJECTS.filter(x=>x.id!=='administracao')){
    const path=join(base,'site/js/unificado/content',s.id,'modules.js');
    assert.ok(existsSync(path));assert.ok(statSync(path).size<20_000);
  }
});
