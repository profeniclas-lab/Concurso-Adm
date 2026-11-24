import test from 'node:test';
import assert from 'node:assert/strict';
import {
 readLegacyState,validateLegacyState,legacyAnsweredQuestionIds,compareHistories,
 buildDualHistorySnapshot,COMPATIBILITY_FORMAT
} from '../site/js/unificado/legacy-compat.js';
import {createTrainingState,recordTrainingAttempt} from '../site/js/unificado/training-engine.js';
import {TRAINING_KEY} from '../site/js/unificado/training-engine.js';
import {renderAdminTraining,handleAdminTrainingClick} from '../site/js/unificado/admin-training-ui.js';

const key='admEstudo.v2.state';
const now='2026-11-24T12:00:00.000Z';
const moduleId='ADM-01';
const q=(id)=>({id,moduleId,options:['A','B'],answer:1});
const state=()=>({schemaVersion:3,appVersion:'2.0.0',navigation:{currentRoute:'dashboard'},
  preferences:{theme:'light'},metadata:{createdAt:now,updatedAt:now},progress:{
    modules:{},lessons:{'ADM-01-001':{completed:true}},diagnostics:{'ADM-01':{answers:{'ADM-01-001':'sei'}}},
    exercises:{},questionHistory:{},flashcards:{},reviewQueue:[],errors:[],
    simulados:{history:[{id:'S-1',finishedAt:now}]},reviewSchedule:{}
  }});
function memory(seed={}){
 const values=new Map(Object.entries(seed)),writes=[];
 return {getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>{writes.push(k);values.set(k,String(v))},removeItem:k=>{writes.push(k);values.delete(k)},get writes(){return writes},snapshot:()=>Object.fromEntries(values)};
}

test('reconhece schema 3 sem alterar o objeto original',()=>{
 const old=state(),copy=structuredClone(old);
 assert.equal(validateLegacyState(old),old);
 assert.deepEqual(old,copy);
});
test('não aceita schema antigo ou registros ausentes',()=>{
 const old=state();old.schemaVersion=2;
 assert.throws(()=>validateLegacyState(old),/incompatível/);
 assert.throws(()=>validateLegacyState({schemaVersion:3}),/incompatível/);
});
test('identifica respostas pelo formato antigo, mas não inventa registros',()=>{
 const old=state();old.progress.questionHistory={
  'Q-ADM-01-A':{bankAttempt:{lastAnswer:1}},
  'Q-ADM-01-B':{lastAnswer:0},
  'Q-ADM-01-C':{attempts:[{at:now,source:'banco',answer:1,correct:true}]},
  'Q-ADM-01-D':{attempts:[],assessment:'acerto_banco'},
  'Q-ADM-01-E':{notes:'sem resposta'},
  'Q-ADM-01-F':{bankAttempt:{lastAnswer:'0'}}
 };
 assert.deepEqual([...legacyAnsweredQuestionIds(old)].sort(),['Q-ADM-01-A','Q-ADM-01-B','Q-ADM-01-C']);
});
test('combina ID de questões sem duplicar, mantém tentativas independentes',()=>{
 const old=state();old.progress.questionHistory={
 'Q-ADM-01-A':{lastAnswer:0,attempts:[{answer:0,correct:false,at:now}]},
 'Q-ADM-01-B':{bankAttempt:{lastAnswer:1}},
 'Q-ADM-01-NO':{assessment:'erro_banco'}
 };const modern=createTrainingState(now);
 recordTrainingAttempt(modern,q('Q-ADM-01-B'),1,{now});
 recordTrainingAttempt(modern,q('Q-ADM-01-C'),0,{now});
 const oldCopy=structuredClone(old),newCopy=structuredClone(modern);
 const result=compareHistories(old,modern,{now});
 assert.deepEqual({distinct:result.distinctUnion,shared:result.overlap,oldOnly:result.oldOnly,newOnly:result.newOnly},
  {distinct:3,shared:1,oldOnly:1,newOnly:1});
 assert.equal(result.legacy.lessons,1);
 assert.equal(result.legacy.simulations,1);
 assert.equal(result.legacy.trackedAttempts,1);
 assert.equal(result.modern.attempts,2);
 assert.deepEqual(old,oldCopy);assert.deepEqual(modern,newCopy);
});
test('agendamento antigo duplicado por ID conta apenas uma vez',()=>{
 const old=state();old.progress.questionHistory['Q-ADM-01-A']={lastAnswer:1,reviewAt:'2026-11-20T10:00:00Z'};
 old.progress.reviewSchedule['item:a']={questionId:'Q-ADM-01-A',dueAt:'2026-11-25T10:00:00Z'};
 const result=compareHistories(old,createTrainingState(now),{now});
 assert.equal(result.legacy.scheduledReviews,1);assert.equal(result.legacy.due,0);
});
test('ausência do legado permite observar somente o novo motor',()=>{
 const modern=createTrainingState(now);recordTrainingAttempt(modern,q('Q-ADM-01-X'),0,{now});
 const r=compareHistories(null,modern,{now});assert.equal(r.hasLegacy,false);assert.equal(r.distinctUnion,1);
});
test('leitura de dados corrompidos bloqueia comparação e não grava',()=>{
 const db=memory({[key]:'{invalid JSON', [TRAINING_KEY]:JSON.stringify(createTrainingState(now))});
 const r=readLegacyState(db);assert.equal(r.ok,false);assert.equal(r.exists,true);assert.deepEqual(db.writes,[]);
});
test('backup copia exatamente o JSON original e moderno, mesmo se legado inválido',()=>{
 const old=' {"schemaVersion":3, "umCampo":"valor"} ',modern=JSON.stringify(createTrainingState(now));
 const db=memory({[key]:old,[TRAINING_KEY]:modern});
 const b=buildDualHistorySnapshot(db,now);
 assert.equal(b.format,COMPATIBILITY_FORMAT);
 assert.deepEqual(b.entries,[{key,raw:old},{key:TRAINING_KEY,raw:modern}]);
 assert.deepEqual(db.writes,[]);
});
test('backup é recusado quando não existe nenhuma das duas fontes',()=>{
 assert.throws(()=>buildDualHistorySnapshot(memory(),now),/Não há histórico/);
});
test('painel de compatibilidade renderiza sem recursão e sem gravar dados',async()=>{
 const old=state();old.progress.questionHistory['Q-ADM-01-A']={lastAnswer:1};
 const db=memory({[key]:JSON.stringify(old),[TRAINING_KEY]:JSON.stringify(createTrainingState(now))});
 const prior=globalThis.localStorage;globalThis.localStorage=db;
 try{
  const main={innerHTML:'aguardando'};
  await renderAdminTraining(['treino-admin','compatibilidade'],main,()=>true);
  assert.match(main.innerHTML,/Compatibilidade dos históricos/);
  assert.match(main.innerHTML,/Somente leitura/);
  assert.match(main.innerHTML,/1<\/strong> questões distintas respondidas/);
  assert.deepEqual(db.writes,[]);
 }finally{if(prior===undefined)delete globalThis.localStorage;else globalThis.localStorage=prior;}
});
test('painel com dados inválidos avisa, não altera os históricos',async()=>{
 const db=memory({[key]:'{}'});const prior=globalThis.localStorage;globalThis.localStorage=db;
 try{
  const main={innerHTML:'vazia'};
  await renderAdminTraining(['treino-admin','compatibilidade'],main,()=>true);
  assert.match(main.innerHTML,/histórico do ADM-ESTUDO não pôde ser interpretado/);
  assert.match(main.innerHTML,/data-train-action="dual-export"/);
  assert.deepEqual(db.writes,[]);
 }finally{if(prior===undefined)delete globalThis.localStorage;else globalThis.localStorage=prior;}
});
test('renderização cancelada não altera a tela atual',async()=>{
 const db=memory();const prior=globalThis.localStorage;globalThis.localStorage=db;
 try{const main={innerHTML:'nova página'};let calls=0;
  await renderAdminTraining(['treino-admin','compatibilidade'],main,()=>++calls===1);
  assert.equal(main.innerHTML,'nova página');assert.deepEqual(db.writes,[]);
 }finally{if(prior===undefined)delete globalThis.localStorage;else globalThis.localStorage=prior;}
});

test('757 questões hipotéticas sobrepostas não somam duas vezes',()=>{
 const old=state(),newState=createTrainingState(now);
 for(let i=0;i<757;i++){
  const id='Q-ADM-01-'+String(i).padStart(5,'0');
  old.progress.questionHistory[id]={lastAnswer:i%2};
  if(i<100)recordTrainingAttempt(newState,q(id),1,{now});
 }
 const r=compareHistories(old,newState,{now});
 assert.equal(r.legacy.distinct,757);assert.equal(r.modern.distinct,100);
 assert.equal(r.overlap,100);assert.equal(r.distinctUnion,757);
});
