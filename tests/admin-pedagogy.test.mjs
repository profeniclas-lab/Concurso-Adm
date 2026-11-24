import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validatePedagogyIndex,calculatePartialAchievement,modulePedagogy,allModulePedagogy,
  planPedagogyImport,preparePedagogyImport,commitPedagogyImport,readPedagogySnapshot,
  inspectPedagogyRecovery,restorePedagogyImport,buildPedagogyBackup,
  PEDAGOGY_STORAGE_KEY,PEDAGOGY_RECOVERY_KEY,PEDAGOGY_BACKUP_FORMAT
} from '../site/js/unificado/admin-pedagogy.js';
import {buildPedagogyIndex} from '../scripts/build-admin-pedagogy-index.mjs';
const now='2026-11-24T15:00:00.000Z';
const prefix=['ADM','AP','DA'];
const ids=[...Array.from({length:12},(_,i)=>`ADM-${String(i+1).padStart(2,'0')}`),
  'AP-13','AP-14',...Array.from({length:13},(_,i)=>`DA-${String(i+15).padStart(2,'0')}`)];
const modules=ids.map(id=>({id,title:`Módulo ${id}`,area:id.split('-')[0],
  subtopics:[{id:`${id}-001`},{id:`${id}-002`}]}));
const questions=modules.flatMap((m,i)=>Array.from({length:i===0?29:28},(_,j)=>({
  id:`Q-${m.id}-${String(j).padStart(3,'0')}`,moduleId:m.id,options:['A','B'],answer:j%2
})));
// 29 + 26*28 = 757
assert.equal(questions.length,757);
const manifest={moduleCount:27,questionCount:757,completeBankSha256:createHash('sha256').update(JSON.stringify(questions)).digest('hex'),
  modules:modules.map(m=>({id:m.id,count:questions.filter(q=>q.moduleId===m.id).length}))};
const lessons=Object.fromEntries(modules.flatMap(m=>m.subtopics.map(t=>[t.id,{concept:'teste'}])));
const diagnostics=Object.fromEntries(modules.map(m=>[m.id,m.subtopics.map(t=>({subtopicId:t.id,front:'?',back:'!'}))]));
const index=buildPedagogyIndex(modules,lessons,diagnostics,questions,manifest);
const q0=questions[0],q1=questions[1];
function legacy(){return {schemaVersion:3,appVersion:'2.0.0',navigation:{currentRoute:'dashboard'},
 preferences:{theme:'light'},metadata:{createdAt:now,updatedAt:now},progress:{
 modules:{},lessons:{[`${ids[0]}-001`]:{completed:true,rating:'duvida',updatedAt:now}},
 diagnostics:{[ids[0]]:{answers:{[`${ids[0]}-001`]:'sei'},updatedAt:now}},
 exercises:{[ids[0]]:{ids:[q0.id,q1.id],answers:{[q0.id]:q0.answer},assessments:{},startedAt:now,finishedAt:null}},
 questionHistory:{[q0.id]:{bankAttempt:{lastAnswer:q0.answer},lastAnswer:q0.answer}},
 flashcards:{},reviewQueue:[],errors:[]
 }}};
function storage(entries={}){const data=new Map(Object.entries(entries));const writes=[];return {getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>{writes.push(k);data.set(k,String(v))},removeItem:k=>{writes.push(k);data.delete(k)},get writes(){return writes},get data(){return data}};}

// Validações de fonte e de correspondência antes de publicar ou importar.
test('índice preserva 27 módulos, 757 questões e gabaritos sem modificar a fonte',()=>{
 const original=JSON.stringify(questions);assert.equal(index.questionCount,757);
 assert.equal(validatePedagogyIndex(index),index);
 assert.deepEqual(index.modules[0].lessonIds,[`${ids[0]}-001`,`${ids[0]}-002`]);
 assert.equal(index.modules[0].bank[0].answer,q0.answer);
 assert.equal(JSON.stringify(questions),original);
});
test('bloqueia publicação com quantidade diferente',()=>assert.throws(()=>buildPedagogyIndex(modules,lessons,diagnostics,questions.slice(1),manifest),/incompleto/));
test('bloqueia catálogo com ID de questão duplicado',()=>{const bad=structuredClone(index);bad.modules[1].bank[0].id=q0.id;assert.throws(()=>validatePedagogyIndex(bad),/duplicado/)});
test('bloqueia índice com subconjunto inválido de subtópicos',()=>{const bad=structuredClone(index);bad.modules[0].lessonIds=['OUT-01'];assert.throws(()=>validatePedagogyIndex(bad),/Subtópicos/)});

test('pesos originais 20 + 15 + 15 + 30 + 20 e cobertura parcial',()=>{
 const a=calculatePartialAchievement({diagnostic:{available:true,score:100,coverage:50},
 lessonCompletion:{available:true,score:100,coverage:50},
 lessonSelfAssessment:{available:true,score:50,coverage:50},
 exercises:{available:true,score:100,coverage:50},bank:{available:true,score:100,coverage:100}});
 assert.equal(a.earnedWeightedPoints,56.25);assert.equal(a.percentage,56);
 assert.equal(a.completed,false);assert.equal(a.availableWeight,60);
 assert.equal(a.components.lessonSelfAssessment.points,3.75);
});
test('75 pontos completos ativam meta, sem exigir 100% de cobertura',()=>{
 const a=calculatePartialAchievement({diagnostic:{available:true,score:100},
 lessonCompletion:{available:true,score:100},
 exercises:{available:true,score:100},bank:{available:true,score:50}});
 assert.equal(a.earnedWeightedPoints,75);assert.equal(a.completed,true);
});
test('74,99 pontos não atingem meta por arredondamento de apresentação',()=>{
 const a=calculatePartialAchievement({diagnostic:{available:true,score:100},
 lessonCompletion:{available:true,score:100},
 lessonSelfAssessment:{available:true,score:100},
 exercises:{available:true,score:83.3}});
 assert.equal(a.earnedWeightedPoints,74.99);assert.equal(a.completed,false);
});
test('espelho de atividade no ADM calcula pontuação sem fundir com treino novo',()=>{
 const old=legacy(),copy=structuredClone(old);
 const a=modulePedagogy(old,index.modules[0]);
 assert.equal(a.earnedWeightedPoints,56.25);assert.equal(a.percentage,56);
 assert.equal(a.evidence.exerciseAnswered,1);assert.equal(a.evidence.bankAnswered,1);
 assert.deepEqual(old,copy);
});
test('módulos sem dados ficam com nota nula, não zero forçado',()=>{
 const a=allModulePedagogy(legacy(),index);
 assert.equal(a.length,27);assert.equal(a[1].percentage,null);assert.equal(a[1].hasData,false);
});
test('diagnóstico com duas respostas não infla nota além de seu peso',()=>{
 const old=legacy();old.progress.diagnostics[ids[0]].answers[`${ids[0]}-002`]='sei';
 assert.equal(modulePedagogy(old,index.modules[0]).components.diagnostic.points,20);
});
test('aula somente avaliada não é fabricada como concluída',()=>{
 const old=legacy();old.progress.lessons[`${ids[0]}-001`].completed=false;
 const a=modulePedagogy(old,index.modules[0]);
 assert.equal(a.evidence.lessonsCompleted,0);assert.equal(a.components.lessonCompletion.available,false);
});

test('importação copia apenas evidências com IDs válidos e registra nota congelada',()=>{
 const old=legacy(),copy=structuredClone(old);
 old.progress.lessons['OUT-01']={completed:true};
 const plan=planPedagogyImport(old,index,{now});
 assert.equal(plan.counts.lessonsCompleted,1);
 assert.equal(plan.counts.lessonRatings,1);
 assert.equal(plan.counts.diagnosticAnswers,1);
 assert.equal(plan.counts.exerciseAnswers,1);
 assert.equal(plan.counts.unknownLessons,1);
 assert.equal(plan.achievements[ids[0]].earnedWeightedPoints,56.25);
 assert.equal(plan.progress.lessons['OUT-01'],undefined);
 assert.equal(plan.progress.exercises[ids[0]].finishedAt,null);
 assert.deepEqual(old.progress.lessons['OUT-01'],copy.progress.lessons['OUT-01']??{completed:true});
});
test('sessão de exercício com ID desconhecido é recusada, sem inventar resultados',()=>{
 const old=legacy();old.progress.exercises[ids[0]].ids.push('Q-DESCONHECIDA');
 const plan=planPedagogyImport(old,index,{now});
 assert.equal(plan.counts.skippedExerciseModules,1);assert.equal(plan.progress.exercises[ids[0]],undefined);
});

test('prévia não escreve nenhuma chave nem apaga histórico',()=>{
 const old=legacy(),raw=JSON.stringify(old),s=storage({'admEstudo.v2.state':raw});
 const d=preparePedagogyImport(index,{storage:s,now});
 assert.equal(d.plan.counts.importedItems,4);
 assert.deepEqual(s.writes,[]);assert.equal(s.getItem('admEstudo.v2.state'),raw);
});
test('grava apenas nova cópia e recuperação após confirmação do backup',()=>{
 const raw=JSON.stringify(legacy()),s=storage({'admEstudo.v2.state':raw});
 const draft=preparePedagogyImport(index,{storage:s,now});
 assert.equal(commitPedagogyImport(draft,{storage:s}).ok,false);
 assert.equal(s.writes.length,0);
 const result=commitPedagogyImport(draft,{storage:s,backupConfirmed:true});
 assert.equal(result.ok,true);
 assert.deepEqual(s.writes,[PEDAGOGY_RECOVERY_KEY,PEDAGOGY_STORAGE_KEY]);
 assert.equal(s.getItem('admEstudo.v2.state'),raw);
 assert.equal(readPedagogySnapshot(s).snapshot.counts.importedItems,4);
});
test('conflito entre abas bloqueia importação e mantém progresso',()=>{
 const raw=JSON.stringify(legacy()),s=storage({'admEstudo.v2.state':raw});
 const draft=preparePedagogyImport(index,{storage:s,now});
 s.setItem('admEstudo.v2.state',raw+' ');
 const result=commitPedagogyImport(draft,{storage:s,backupConfirmed:true});
 assert.equal(result.ok,false);assert.equal(s.getItem(PEDAGOGY_STORAGE_KEY),null);
});
test('cópia já existente bloqueia nova importação, sem sobrescrever',()=>{
 const raw=JSON.stringify(legacy()),s=storage({'admEstudo.v2.state':raw});
 const draft=preparePedagogyImport(index,{storage:s,now});
 assert.equal(commitPedagogyImport(draft,{storage:s,backupConfirmed:true}).ok,true);
 assert.throws(()=>preparePedagogyImport(index,{storage:s,now}),/existe/);
});
test('restauração exata desfaz importação sem alterar a chave original',()=>{
 const raw=JSON.stringify(legacy()),s=storage({'admEstudo.v2.state':raw});
 const draft=preparePedagogyImport(index,{storage:s,now});
 assert.equal(commitPedagogyImport(draft,{storage:s,backupConfirmed:true}).ok,true);
 assert.equal(inspectPedagogyRecovery(s).canRestore,true);
 assert.equal(restorePedagogyImport({storage:s,confirmed:true}).ok,true);
 assert.equal(s.getItem(PEDAGOGY_STORAGE_KEY),null);
 assert.equal(s.getItem(PEDAGOGY_RECOVERY_KEY),null);
 assert.equal(s.getItem('admEstudo.v2.state'),raw);
});
test('dados escritos após a migração impedem reversão destrutiva',()=>{
 const raw=JSON.stringify(legacy()),s=storage({'admEstudo.v2.state':raw});
 const draft=preparePedagogyImport(index,{storage:s,now});
 assert.equal(commitPedagogyImport(draft,{storage:s,backupConfirmed:true}).ok,true);
 s.setItem(PEDAGOGY_STORAGE_KEY,s.getItem(PEDAGOGY_STORAGE_KEY)+' ');
 assert.equal(inspectPedagogyRecovery(s).canRestore,false);
 assert.equal(restorePedagogyImport({storage:s,confirmed:true}).ok,false);
});
test('backup inclui os quatro registros brutos, inclusive recuperação',()=>{
 const raw=JSON.stringify(legacy()),s=storage({'admEstudo.v2.state':raw});
 const payload=buildPedagogyBackup(s,now);
 assert.equal(payload.format,PEDAGOGY_BACKUP_FORMAT);
 assert.equal(payload.entries.length,4);
 assert.equal(payload.entries.find(x=>x.key==='admEstudo.v2.state').raw,raw);
 assert.deepEqual(s.writes,[]);
});
test('registro pedagógico incompatível é preservado e leitura não apaga',()=>{
 const s=storage({[PEDAGOGY_STORAGE_KEY]:'{quebrado'});
 assert.equal(readPedagogySnapshot(s).ok,false);assert.deepEqual(s.writes,[]);
});

test('rota #treino-admin/pedagogia renderiza sem recursão e sem gravar armazenamento',async()=>{
 const {renderAdminTraining}=await import('../site/js/unificado/admin-training-ui.js');
 const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage;
 const raw=JSON.stringify(legacy());const s=storage({'admEstudo.v2.state':raw});
 globalThis.localStorage=s;
 globalThis.fetch=async()=>({ok:true,json:async()=>index});
 try{
   const main={innerHTML:''};
   await renderAdminTraining(['treino-admin','pedagogia'],main);
   assert.match(main.innerHTML,/Aproveitamento parcial por módulo/);
   assert.match(main.innerHTML,/ADM-01/);
   assert.match(main.innerHTML,/56%/);
   assert.match(main.innerHTML,/75 pontos/);
   assert.deepEqual(s.writes,[]);
 }finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;}
});
