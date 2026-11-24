import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPedagogyIndex} from '../scripts/build-admin-pedagogy-index.mjs';
import {planPedagogyImport,preparePedagogyImport,restorePedagogyImport,
  PEDAGOGY_STORAGE_KEY,PEDAGOGY_RECOVERY_KEY} from '../site/js/unificado/admin-pedagogy.js';
import {modulePedagogy} from '../site/js/unificado/admin-pedagogy.js';
import {buildPhase7EBackup,PHASE7E_KEYS} from '../site/js/unificado/phase7e-audit.js';
import {renderSharedModule,handleSharedModuleClick} from '../site/js/unificado/shared-module-ui.js';
import {readSharedBaseline,buildSharedStudyView} from '../site/js/unificado/shared-activity-bridge.js';
import {calculateSharedModuleProgress} from '../site/js/unificado/shared-progress.js';
import {
 SHARED_ACTIVITY_FORMAT,ADMIN_SHARED_ACTIVITY_KEY,sharedActivityKey,createSharedActivityState,
 validateSharedActivityState,readSharedActivityState,applySharedActivity,saveSharedActivity,
 fingerprintBaseline,hasSharedActivity
} from '../site/js/unificado/shared-activity-store.js';
const now='2026-11-24T19:30:00.000Z',oldAt='2026-11-22T10:00:00.000Z';
const ids=[...Array.from({length:12},(_,i)=>`ADM-${String(i+1).padStart(2,'0')}`),'AP-13','AP-14',
 ...Array.from({length:13},(_,i)=>`DA-${String(i+15).padStart(2,'0')}`)];
const modules=ids.map(id=>({id,title:'Módulo '+id,area:id.split('-')[0],
 subtopics:[{id:`${id}-001`,title:'Primeiro tópico'},{id:`${id}-002`,title:'Segundo tópico'}]}));
const bank=modules.flatMap((m,i)=>Array.from({length:i===0?29:28},(_,j)=>({
 id:`Q-${m.id}-${String(j).padStart(3,'0')}`,moduleId:m.id,options:['A','B'],answer:j%2
})));
const manifest={moduleCount:27,questionCount:757,
 completeBankSha256:createHash('sha256').update(JSON.stringify(bank)).digest('hex'),
 modules:modules.map(m=>({id:m.id,count:bank.filter(q=>q.moduleId===m.id).length}))};
const lessons=Object.fromEntries(modules.flatMap(m=>m.subtopics.map(t=>[t.id,{id:t.id,concept:'conceito'}])));
const diagnostics=Object.fromEntries(modules.map(m=>[m.id,m.subtopics.map(t=>({subtopicId:t.id,front:'Pergunta?',back:'Resposta'}))]));
const index=buildPedagogyIndex(modules,lessons,diagnostics,bank,manifest);
const b=()=>({format:'estudo-concursos/shared-module/v1',subjectId:'administracao',moduleId:'ADM-01',
 title:'Módulo ADM-01',area:'ADM',subtopics:modules[0].subtopics,questionCount:29,
 lessons:{'ADM-01-001':{id:'ADM-01-001',concept:'conceito'},'ADM-01-002':{id:'ADM-01-002',concept:'conceito 2'}},
 diagnostic:diagnostics['ADM-01']});
const original=()=>({schemaVersion:3,navigation:{currentRoute:'dashboard'},preferences:{theme:'light'},
 metadata:{createdAt:oldAt,updatedAt:oldAt},progress:{modules:{},
 lessons:{'ADM-01-001':{completed:true,rating:'duvida',updatedAt:oldAt}},
 diagnostics:{'ADM-01':{answers:{'ADM-01-001':'sei'},updatedAt:oldAt}},
 exercises:{'ADM-01':{ids:[bank[0].id,bank[1].id],answers:{[bank[0].id]:bank[0].answer},startedAt:oldAt,finishedAt:null}},
 questionHistory:{[bank[0].id]:{bankAttempt:{lastAnswer:bank[0].answer},lastAnswer:bank[0].answer}},
 flashcards:{},reviewQueue:[],errors:[]}});
const storage=(init={})=>{const map=new Map(Object.entries(init)),writes=[];
 return {getItem:k=>map.has(k)?map.get(k):null,
  setItem:(k,v)=>{writes.push(k);map.set(k,String(v))},
  removeItem:k=>{writes.push(k);map.delete(k)},writes,map};};
const legacyDb=()=>storage({'admEstudo.v2.state':JSON.stringify(original())});
const action=(kind,topicId='ADM-01-002',rating='sei')=>({kind,topicId,rating});
const save=(db,task)=>saveSharedActivity('administracao',b(),task,{storage:db,baselineReader:readSharedBaseline,now});
const view=(db)=>buildSharedStudyView(b(),{storage:db,indexLoader:async()=>index});

test('fábrica de estado aceita uma disciplina por chave e não grava na leitura',()=>{
 const db=storage();const read=readSharedActivityState('administracao',db);
 assert.equal(read.exists,false);assert.equal(read.state.format,SHARED_ACTIVITY_FORMAT);
 assert.deepEqual(db.writes,[]);
 assert.equal(sharedActivityKey('administracao'),ADMIN_SHARED_ACTIVITY_KEY);
 assert.notEqual(sharedActivityKey('portugues'),ADMIN_SHARED_ACTIVITY_KEY);
});
test('rejeita versões incompatíveis e respostas sem subtópico válido',()=>{
 const st=createSharedActivityState('administracao',{now});st.schemaVersion=2;
 assert.throws(()=>validateSharedActivityState(st,'administracao'),/incompatível/);
 const r=createSharedActivityState('administracao',{now});r.diagnostics['ADM-01']={answers:{'DA-27-001':'sei'}};
 assert.throws(()=>validateSharedActivityState(r,'administracao'),/inválida/);
});
test('só aceita três classificações e subtópicos do bundle',()=>{
 const r=createSharedActivityState('administracao',{now});
 assert.throws(()=>applySharedActivity(r,b(),action('diagnostic','ADM-01-002','inventado')),/inválida/);
 assert.throws(()=>applySharedActivity(r,b(),action('lesson-complete','DA-27-001')),/pertence/);
 assert.throws(()=>applySharedActivity(r,b(),action('lesson-rating','ADM-01-999')),/pertence/);
 assert.deepEqual(r.diagnostics,{});
});
test('primeira resposta grava somente a chave nova e vincula o hash da fonte',async()=>{
 const db=legacyDb(),raw=db.getItem('admEstudo.v2.state');
 const r=await save(db,action('diagnostic'));
 assert.equal(r.ok,true);assert.deepEqual(db.writes,[ADMIN_SHARED_ACTIVITY_KEY]);
 assert.equal(db.getItem('admEstudo.v2.state'),raw);assert.equal(db.getItem(PEDAGOGY_STORAGE_KEY),null);
 const saved=readSharedActivityState('administracao',db).state;
 assert.equal(saved.diagnostics['ADM-01'].answers['ADM-01-002'],'sei');
 assert.equal(saved.baseline.source,'legacy');assert.match(saved.baseline.digest,/^[a-f0-9]{64}$/);
});
test('a segunda resposta atualiza a mesma chave e mantém o mesmo hash',async()=>{
 const db=legacyDb();await save(db,action('diagnostic'));
 const hash=readSharedActivityState('administracao',db).state.baseline.digest;
 const r=await save(db,action('diagnostic','ADM-01-002','duvida'));
 assert.equal(r.ok,true);assert.equal(r.state.diagnostics['ADM-01'].answers['ADM-01-002'],'duvida');
 assert.equal(r.state.baseline.digest,hash);
 assert.deepEqual(db.writes,[ADMIN_SHARED_ACTIVITY_KEY,ADMIN_SHARED_ACTIVITY_KEY]);
});
test('atividade herdada não é duplicada: conclusão permanece única',async()=>{
 const db=legacyDb();const before=await view(db);
 assert.equal(before.score.earnedWeightedPoints,56.25);
 await save(db,action('lesson-complete','ADM-01-001'));
 const after=await view(db);
 assert.equal(after.score.earnedWeightedPoints,56.25);
 assert.equal(after.score.evidence.lessonsDone,1);
 assert.equal(after.score.subtopics['ADM-01-001'].lessonOrigin,'novo');
});
test('diagnóstico e autoavaliação novos mudam exatamente os pontos ponderados',async()=>{
 const db=legacyDb();
 await save(db,action('diagnostic','ADM-01-002','sei'));
 assert.equal((await view(db)).score.earnedWeightedPoints,66.25);
 await save(db,action('lesson-rating','ADM-01-001','sei'));
 assert.equal((await view(db)).score.earnedWeightedPoints,70);
 await save(db,action('lesson-complete','ADM-01-002'));
 const result=await view(db);
 assert.equal(result.score.earnedWeightedPoints,77.5);
 assert.equal(result.score.completed,true);
 assert.equal(result.score.components.exercises.points,15);
 assert.equal(result.score.components.bank.points,20);
});
test('sem histórico anterior a nota começa indefinida e nasce só com evidência nova',async()=>{
 const db=storage();const start=await view(db);
 assert.equal(start.score.hasData,false);assert.equal(start.score.percentage,null);
 await save(db,action('diagnostic','ADM-01-001','sei'));
 assert.equal((await view(db)).score.earnedWeightedPoints,10);
 await save(db,action('lesson-complete','ADM-01-001'));
 assert.equal((await view(db)).score.earnedWeightedPoints,17.5);
 await save(db,action('lesson-rating','ADM-01-001','sei'));
 assert.equal((await view(db)).score.earnedWeightedPoints,25);
});
test('nota derivada com overlay não altera a referência nem o estado de entrada',()=>{
 const old=original(),base=modulePedagogy(old,index.modules[0]);
 const rec=createSharedActivityState('administracao',{now});
 applySharedActivity(rec,b(),action('diagnostic'));
 const copies=[structuredClone(old),structuredClone(rec),structuredClone(base)];
 const a=calculateSharedModuleProgress(b(),old.progress,base,rec);
 assert.equal(a.earnedWeightedPoints,66.25);
 assert.deepEqual([old,rec,base],copies);
});
test('a importação da F7C prevalece mesmo que o legado continue recebendo atividade',async()=>{
 const old=original(),imported=planPedagogyImport(old,index,{now:oldAt});
 const db=storage({'admEstudo.v2.state':JSON.stringify(old),[PEDAGOGY_STORAGE_KEY]:JSON.stringify(imported)});
 const first=await view(db);assert.equal(first.source,'imported');assert.equal(first.score.earnedWeightedPoints,56.25);
 await save(db,action('diagnostic'));
 old.metadata.updatedAt=now;old.progress.lessons['ADM-01-002']={completed:true,rating:'sei'};
 db.setItem('admEstudo.v2.state',JSON.stringify(old));
 const next=await view(db);
 assert.equal(next.locked,false);assert.equal(next.source,'imported');
 assert.equal(next.score.earnedWeightedPoints,66.25);
});
test('mudança no legado depois da gravação bloqueia novas respostas e a nota combinada',async()=>{
 const db=legacyDb();await save(db,action('diagnostic'));
 const old=original();old.metadata.updatedAt=now;
 db.setItem('admEstudo.v2.state',JSON.stringify(old));
 const locked=await view(db);assert.equal(locked.locked,true);assert.equal(locked.score,null);
 const before=db.writes.length;
 const r=await save(db,action('lesson-complete'));assert.equal(r.ok,false);assert.match(r.message,/mudou/);
 assert.equal(db.writes.length,before);
});
test('mudança na cópia F7C bloqueia gravação e impede mistura silenciosa',async()=>{
 const imported=planPedagogyImport(original(),index,{now:oldAt});
 const db=storage({[PEDAGOGY_STORAGE_KEY]:JSON.stringify(imported)});
 await save(db,action('diagnostic'));
 const modified={...imported,metadata:{...imported.metadata,importedAt:now}};
 db.setItem(PEDAGOGY_STORAGE_KEY,JSON.stringify(modified));
 assert.equal((await view(db)).locked,true);
 assert.equal((await save(db,action('lesson-complete'))).ok,false);
});
test('conflito entre abas: alteração da nova chave durante leitura bloqueia a gravação',async()=>{
 const db=legacyDb();let hits=0;
 const baselineReader=st=>{const r=readSharedBaseline(st);if(++hits===2)st.setItem(ADMIN_SHARED_ACTIVITY_KEY,'{"concorrente":true}');return r;};
 const result=await saveSharedActivity('administracao',b(),action('diagnostic'),{storage:db,baselineReader,now});
 assert.equal(result.ok,false);assert.match(result.message,/outra aba/);
 assert.equal(db.getItem('admEstudo.v2.state')!==null,true);
});
test('alteração do legado durante leitura bloqueia o commit',async()=>{
 const db=legacyDb();let hits=0;
 const baselineReader=st=>{const r=readSharedBaseline(st);if(++hits===2)st.setItem('admEstudo.v2.state',r.raw+' ');return r;};
 const result=await saveSharedActivity('administracao',b(),action('diagnostic'),{storage:db,baselineReader,now});
 assert.equal(result.ok,false);assert.match(result.message,/origem ou as atividades foram alteradas/);
});
test('armazenamento incompatível não é substituído nem zerado',async()=>{
 const db=storage({[ADMIN_SHARED_ACTIVITY_KEY]:'JSON INCOMPATÍVEL'});
 const result=await save(db,action('diagnostic'));
 assert.equal(result.ok,false);assert.equal(db.getItem(ADMIN_SHARED_ACTIVITY_KEY),'JSON INCOMPATÍVEL');
 assert.deepEqual(db.writes,[]);
});
test('falha por falta de espaço bloqueia registro sem tocar em dados legados',async()=>{
 const db=legacyDb();db.setItem=(key)=>{throw new Error('QuotaExceededError')};
 const old=db.getItem('admEstudo.v2.state');const r=await save(db,action('lesson-rating'));
 assert.equal(r.ok,false);assert.equal(db.getItem('admEstudo.v2.state'),old);
});
test('rollback F7C é impedido depois de atividade nova, sem apagar estudo',async()=>{
 const db=legacyDb(),snapshot=planPedagogyImport(original(),index,{now:oldAt});
 db.setItem(PEDAGOGY_STORAGE_KEY,JSON.stringify(snapshot));
 db.setItem(PEDAGOGY_RECOVERY_KEY,JSON.stringify({format:'estudo-concursos/pedagogy-recovery/v1',
  previousRaw:null,afterRaw:db.getItem(PEDAGOGY_STORAGE_KEY),createdAt:now}));
 await save(db,action('lesson-rating'));
 const oldRaw=db.getItem(PEDAGOGY_STORAGE_KEY),newRaw=db.getItem(ADMIN_SHARED_ACTIVITY_KEY);
 const result=restorePedagogyImport({storage:db,confirmed:true});
 assert.equal(result.ok,false);assert.match(result.message,/Fase 8B/);
 assert.equal(db.getItem(PEDAGOGY_STORAGE_KEY),oldRaw);assert.equal(db.getItem(ADMIN_SHARED_ACTIVITY_KEY),newRaw);
});
test('importação F7C posterior a estudo 8B não altera a fonte de origem',async()=>{
 const db=legacyDb();await save(db,action('diagnostic'));
 const old=original();assert.throws(()=>preparePedagogyImport(index,{storage:db,now}),/Fase 8B/);
 assert.equal(db.getItem(PEDAGOGY_STORAGE_KEY),null);assert.equal(db.getItem('admEstudo.v2.state'),JSON.stringify(old));
});
test('backup da auditoria inclui a sexta chave F8B sem interpretar nem alterar valores',()=>{
 const db=storage({[ADMIN_SHARED_ACTIVITY_KEY]:'json original  ç  '}),copy=buildPhase7EBackup(db,now);
 assert.equal(copy.entries.length,6);
 assert.equal(copy.entries.find(x=>x.key===ADMIN_SHARED_ACTIVITY_KEY).raw,'json original  ç  ');
 assert.deepEqual(db.writes,[]);
 assert.ok(PHASE7E_KEYS.includes(ADMIN_SHARED_ACTIVITY_KEY));
});
test('aula permite conclusão e autoavaliação, diagnóstico só mostra escolhas após abrir o verso',async()=>{
 const db=storage(),main={innerHTML:''};
 const loader=async()=>b();const viewLoader=()=>view(db);
 await renderSharedModule(['estudo','administracao','ADM-01','aula','1'],main,()=>true,loader,viewLoader);
 assert.match(main.innerHTML,/lesson-complete/);assert.match(main.innerHTML,/lesson-rating/);
 assert.match(main.innerHTML,/Recuperação ativa|Conclusão e autoavaliação/);
 await renderSharedModule(['estudo','administracao','ADM-01','diagnostico','1'],main,()=>true,loader,viewLoader);
 assert.match(main.innerHTML,/<details/);assert.match(main.innerHTML,/data-shared-action="diagnostic"/);
 assert.match(main.innerHTML,/Revelar resposta/);assert.deepEqual(db.writes,[]);
});
test('rota inválida de outro módulo não altera dados',async()=>{
 const db=legacyDb();const r=await save(db,action('diagnostic','DA-27-001'));
 assert.equal(r.ok,false);assert.deepEqual(db.writes,[]);
});
test('handler de botão da tela salva uma resposta e atualiza o painel',async()=>{
 const before=globalThis.location;const oldAlert=globalThis.alert;
 const db=legacyDb();globalThis.location={hash:'#estudo/administracao/ADM-01/diagnostico/2'};
 let rerenders=0;const btn={dataset:{sharedAction:'diagnostic',sharedTopic:'ADM-01-002',sharedRating:'sei'},disabled:false};
 try{
  const event={target:{closest:()=>btn}};
  const result=await handleSharedModuleClick(event,async()=>{rerenders++;},{loader:async()=>b(),storage:db,viewLoader:()=>view(db)});
  assert.equal(result,true);assert.equal(rerenders,1);
  assert.equal(readSharedActivityState('administracao',db).state.diagnostics['ADM-01'].answers['ADM-01-002'],'sei');
 }finally{if(before===undefined)delete globalThis.location;else globalThis.location=before;
  if(oldAlert===undefined)delete globalThis.alert;else globalThis.alert=oldAlert;}
});
test('hash SHA-256 é sensível à alteração de um único byte',async()=>{
 const a=await fingerprintBaseline({source:'legacy',raw:'{"a":1}'});
 const b2=await fingerprintBaseline({source:'legacy',raw:'{"a":1} '});
 assert.notEqual(a.digest,b2.digest);assert.match(a.digest,/^[0-9a-f]{64}$/);
});

test('auditoria 8B detecta divergências e aceita cálculo equivalente em 27 módulos',async()=>{
 const {verifySharedParity}=await import('../scripts/audit-phase8b-parity.mjs');
 const bundles=new Map(modules.map(m=>[m.id,{
   subjectId:'administracao',moduleId:m.id,subtopics:m.subtopics,
   lessons:Object.fromEntries(m.subtopics.map(t=>[t.id,{id:t.id}])),
   diagnostic:m.subtopics.map(t=>({subtopicId:t.id,front:'?',back:'!'}))
 }]));
 const original=(state,m)=>modulePedagogy(state,index.modules.find(x=>x.id===m.id));
 const result=verifySharedParity({index,modules,bundles,originalAchievement:original,scenarios:2});
 assert.deepEqual(result,{scenarios:2,modules:27,comparisons:108,discrepancies:0});
 const wrong=(state,m)=>({...original(state,m),earnedWeightedPoints:99});
 assert.throws(()=>verifySharedParity({index,modules,bundles,originalAchievement:wrong,scenarios:1}),/divergências/);
});

test('disciplinas não migradas continuam leitura, sem criar segundo histórico paralelo',async()=>{
 const db=storage(),bundle={...b(),subjectId:'portugues',moduleId:'POR-01',title:'Português',
  subtopics:[{id:'POR-01-001',title:'Texto'}],lessons:{'POR-01-001':{concept:'Texto'}},
  diagnostic:[{subtopicId:'POR-01-001',front:'Pergunta?',back:'Resposta'}]};
 const main={innerHTML:''};
 await renderSharedModule(['estudo','portugues','POR-01','aula','1'],main,()=>true,
  async()=>bundle,async()=>({locked:false,score:{subtopics:{}}}));
 assert.match(main.innerHTML,/somente leitura/);
 assert.match(main.innerHTML,/data-shared-action="lesson-rating"[^>]*disabled/);
 assert.deepEqual(db.writes,[]);
});
