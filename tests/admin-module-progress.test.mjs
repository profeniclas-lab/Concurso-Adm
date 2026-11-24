/** Fase 7D: progresso dos módulos, importado ou legado, SEM escrita. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPedagogyIndex} from '../scripts/build-admin-pedagogy-index.mjs';
import {planPedagogyImport,PEDAGOGY_STORAGE_KEY} from '../site/js/unificado/admin-pedagogy.js';
import {buildAdminModuleProgress,assertCompatiblePedagogySnapshot,ratingLabel} from '../site/js/unificado/admin-module-progress.js';
import {createTrainingState,recordTrainingAttempt,TRAINING_KEY} from '../site/js/unificado/training-engine.js';
import {renderAdminTraining} from '../site/js/unificado/admin-training-ui.js';

const now='2026-11-24T15:30:00.000Z',earlier='2026-11-22T10:00:00.000Z';
const ids=[...Array.from({length:12},(_,i)=>`ADM-${String(i+1).padStart(2,'0')}`),
  'AP-13','AP-14',...Array.from({length:13},(_,i)=>`DA-${String(i+15).padStart(2,'0')}`)];
const modules=ids.map(id=>({id,title:`Conteúdo de ${id}`,area:id.split('-')[0],
  subtopics:[{id:`${id}-001`,title:'Primeira aula'},{id:`${id}-002`,title:'Segunda aula'}]}));
const bank=modules.flatMap((m,i)=>Array.from({length:i===0?29:28},(_,j)=>({
  id:`Q-${m.id}-${String(j).padStart(3,'0')}`,moduleId:m.id,options:['Certo','Errado'],answer:j%2
})));
assert.equal(bank.length,757);
const q0=bank[0];
const manifest={moduleCount:27,questionCount:757,
  completeBankSha256:createHash('sha256').update(JSON.stringify(bank)).digest('hex'),
  modules:modules.map(m=>({id:m.id,count:bank.filter(q=>q.moduleId===m.id).length}))};
const lessons=Object.fromEntries(modules.flatMap(m=>m.subtopics.map(t=>[t.id,{title:t.title}])));
const diagnostics=Object.fromEntries(modules.map(m=>[m.id,m.subtopics.map(t=>({subtopicId:t.id,front:'?',back:'!'}))]));
const index=buildPedagogyIndex(modules,lessons,diagnostics,bank,manifest);
const old=()=>({schemaVersion:3,navigation:{currentRoute:'dashboard'},preferences:{theme:'light'},
 metadata:{createdAt:earlier,updatedAt:earlier},progress:{modules:{},lessons:{[`${ids[0]}-001`]:{completed:true,rating:'duvida',updatedAt:earlier}},
 diagnostics:{[ids[0]]:{answers:{[`${ids[0]}-001`]:'sei'},updatedAt:earlier}},
 exercises:{[ids[0]]:{ids:[q0.id,bank[1].id],answers:{[q0.id]:q0.answer},assessments:{},finishedAt:null}},
 questionHistory:{[q0.id]:{bankAttempt:{lastAnswer:q0.answer},lastAnswer:q0.answer}},
 flashcards:{},errors:[],reviewQueue:[]}});
const training=()=>createTrainingState(now);
function store(initial={}){
 const data=new Map(Object.entries(initial)),writes=[];
 return {getItem:k=>data.has(k)?data.get(k):null,
   setItem:(k,v)=>{writes.push(k);data.set(k,String(v))},
   removeItem:k=>{writes.push(k);data.delete(k)},writes};
}

test('índice novo preserva títulos reais dos subtópicos, questões e gabaritos',()=>{
 assert.equal(index.moduleCount,27);assert.equal(index.questionCount,757);
 assert.deepEqual(index.modules[0].subtopics,[{id:'ADM-01-001',title:'Primeira aula'},{id:'ADM-01-002',title:'Segunda aula'}]);
 assert.equal(index.modules[0].bank[0].answer,q0.answer);
});
test('sem histórico a nota é indefinida, não 0% de reprovação',()=>{
 const result=buildAdminModuleProgress(index,training(),{now});
 assert.equal(result.rows.length,27);assert.equal(result.started,0);assert.equal(result.atGoal,0);
 assert.equal(result.rows[0].percentage,null);assert.equal(result.rows[0].earnedWeightedPoints,null);
 assert.equal(result.rows[0].training.distinct,0);
});
test('só com histórico original a regra de 75 e os pesos não mudam',()=>{
 const result=buildAdminModuleProgress(index,training(),{legacy:old(),now});
 assert.equal(result.source,'legacy');assert.equal(result.started,1);
 assert.equal(result.rows[0].earnedWeightedPoints,56.25);
 assert.equal(result.rows[0].percentage,56);
 assert.equal(result.rows[0].completed,false);
 assert.equal(result.rows[0].components.diagnostic.points,10);
 assert.equal(result.rows[0].components.lessonCompletion.points,7.5);
 assert.equal(result.rows[0].components.lessonSelfAssessment.points,3.75);
 assert.equal(result.rows[0].components.exercises.points,15);
 assert.equal(result.rows[0].components.bank.points,20);
});
test('importação 7C prevalece sobre mudanças posteriores no ADM-ESTUDO',()=>{
 const source=old();const imported=planPedagogyImport(source,index,{now:earlier});
 source.progress.diagnostics[ids[0]].answers[`${ids[0]}-002`]='sei';
 source.progress.lessons[`${ids[0]}-002`]={completed:true,rating:'sei'};
 source.metadata.updatedAt=now;
 const result=buildAdminModuleProgress(index,training(),{legacy:source,imported,now});
 assert.equal(result.source,'imported');assert.equal(result.sourceMayBeOlder,true);
 assert.equal(result.rows[0].earnedWeightedPoints,56.25);
 assert.equal(result.rows[0].subtopics[1].diagnostic,null);
 assert.equal(result.rows[0].subtopics[1].lessonCompleted,false);
});
test('pontuação importada não recebe acertos do novo motor',()=>{
 const source=old(),imported=planPedagogyImport(source,index,{now:earlier});
 const newer=training();recordTrainingAttempt(newer,q0,q0.answer,{now});
 const result=buildAdminModuleProgress(index,newer,{legacy:source,imported,now});
 assert.equal(result.rows[0].earnedWeightedPoints,56.25);
 assert.equal(result.rows[0].training.distinct,1);
 assert.equal(result.rows[0].training.attempts,1);
 assert.equal(result.rows[0].training.accuracy,100);
 assert.equal(result.rows[0].training.withErrors,0);
});
test('treino com erros e revisão vencida não altera a nota sem dados pedagógicos',()=>{
 const newer=training();const before='2026-11-18T10:00:00.000Z';
 recordTrainingAttempt(newer,q0,1-q0.answer,{now:before});
 const result=buildAdminModuleProgress(index,newer,{now});
 assert.equal(result.rows[0].training.due,1);
 assert.equal(result.rows[0].training.withErrors,1);
 assert.equal(result.rows[0].training.distinct,1);
 assert.equal(result.rows[0].earnedWeightedPoints,null);
});
test('estados originais e importados não são mutados pelo adaptador',()=>{
 const source=old(),imported=planPedagogyImport(source,index,{now:earlier}),newer=training();
 recordTrainingAttempt(newer,q0,q0.answer,{now});
 const copies=[structuredClone(source),structuredClone(imported),structuredClone(newer),structuredClone(index)];
 buildAdminModuleProgress(index,newer,{legacy:source,imported,now});
 assert.deepEqual([source,imported,newer,index],copies);
});
test('rejeita fotografia gerada por outro catálogo, sem regravar',()=>{
 const imported=planPedagogyImport(old(),index,{now:earlier});
 imported.metadata.catalogSha256='a'.repeat(64);
 assert.throws(()=>assertCompatiblePedagogySnapshot(imported,index),/não corresponde ao catálogo atual/);
});
test('rejeita notas forjadas, incoerentes ou parcialmente corrompidas',()=>{
 const imported=planPedagogyImport(old(),index,{now:earlier});
 imported.achievements[ids[0]].earnedWeightedPoints=99;
 assert.throws(()=>buildAdminModuleProgress(index,training(),{imported,now}),/Soma pedagógica incompatível|Nota pedagógica importada/);
});
test('rejeita versão errada de progresso, nenhum fallback destrutivo',()=>{
 const state=training();state.schemaVersion=9;
 assert.throws(()=>buildAdminModuleProgress(index,state,{now}),/incompatível/);
});
test('alcançar 75 mantém decisão por pontos conquistados, não pelo inteiro exibido',()=>{
 const source=old();const imported=planPedagogyImport(source,index,{now:earlier});
 const achieved=imported.achievements[ids[0]];
 // Simula a pontuação 75 com componentes consistentes (sem recalcular evidências).
 achieved.components.diagnostic.points=20;
 achieved.components.lessonCompletion.points=15;
 achieved.components.lessonSelfAssessment.points=10;
 achieved.components.exercises.points=20;
 achieved.components.bank.points=10;
 achieved.earnedWeightedPoints=75;achieved.percentage=75;achieved.completed=true;
 const result=buildAdminModuleProgress(index,training(),{imported,now});
 assert.equal(result.rows[0].completed,true);
 assert.equal(result.atGoal,1);
});
test('labels de diagnóstico e aula não inferem avaliações ausentes',()=>{
 const result=buildAdminModuleProgress(index,training(),{legacy:old(),now});
 const [first,second]=result.rows[0].subtopics;
 assert.equal(first.title,'Primeira aula');assert.equal(first.diagnostic,'sei');
 assert.equal(first.lessonRating,'duvida');assert.equal(first.lessonCompleted,true);
 assert.equal(second.diagnostic,null);assert.equal(second.lessonCompleted,false);
 assert.equal(ratingLabel(second.diagnostic),'Pendente');
});

test('rota de módulos renderiza evidências importadas sem escrever progresso',async()=>{
 const source=old(),imported=planPedagogyImport(source,index,{now:earlier});
 const db=store({'admEstudo.v2.state':JSON.stringify(source),[PEDAGOGY_STORAGE_KEY]:JSON.stringify(imported),[TRAINING_KEY]:JSON.stringify(training())});
 const oldStorage=globalThis.localStorage,oldFetch=globalThis.fetch;
 globalThis.localStorage=db;
 globalThis.fetch=async()=>({ok:true,json:async()=>index});
 try{
   const main={innerHTML:'inicial'};
   await renderAdminTraining(['treino-admin','modulos'],main,()=>true);
   assert.match(main.innerHTML,/Módulos: progresso e questões/);
   assert.match(main.innerHTML,/56,25 de 100 pontos/);
   assert.match(main.innerHTML,/treino-admin\/modulo\/ADM-01/);
   assert.match(main.innerHTML,/Responder questões/);
   assert.deepEqual(db.writes,[]);
 }finally{
   if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;
   if(oldFetch===undefined)delete globalThis.fetch;else globalThis.fetch=oldFetch;
 }
});
test('detalhe do módulo exibe subtópicos, componentes e treino em seções distintas',async()=>{
 const source=old(),imported=planPedagogyImport(source,index,{now:earlier});
 const newer=training();recordTrainingAttempt(newer,q0,q0.answer,{now});
 const db=store({'admEstudo.v2.state':JSON.stringify(source),[PEDAGOGY_STORAGE_KEY]:JSON.stringify(imported),[TRAINING_KEY]:JSON.stringify(newer)});
 const oldStorage=globalThis.localStorage,oldFetch=globalThis.fetch;
 globalThis.localStorage=db;globalThis.fetch=async()=>({ok:true,json:async()=>index});
 try{
   const main={innerHTML:'inicial'};
   await renderAdminTraining(['treino-admin','modulo',ids[0]],main,()=>true);
   assert.match(main.innerHTML,/Aproveitamento pedagógico/);
   assert.match(main.innerHTML,/56,25/);
   assert.match(main.innerHTML,/Primeira aula/);
   assert.match(main.innerHTML,/Eu sei/);
   assert.match(main.innerHTML,/Histórico independente|histórico independente/);
   assert.match(main.innerHTML,/1<\/strong><span class="stat-label">Questões distintas respondidas/);
   assert.deepEqual(db.writes,[]);
 }finally{
   if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;
   if(oldFetch===undefined)delete globalThis.fetch;else globalThis.fetch=oldFetch;
 }
});
test('rota de detalhes sem módulo cadastrado não altera o elemento',async()=>{
 const db=store();const prev=globalThis.localStorage;globalThis.localStorage=db;
 try{
   await assert.rejects(renderAdminTraining(['treino-admin','modulo','ADM-99'],{innerHTML:'carregando'},()=>true),/não encontrado/);
   assert.deepEqual(db.writes,[]);
 }finally{if(prev===undefined)delete globalThis.localStorage;else globalThis.localStorage=prev;}
});
test('renderização obsoleta não substitui a página nem grava progresso',async()=>{
 const db=store();const prev=globalThis.localStorage;globalThis.localStorage=db;
 try{
   let calls=0;const main={innerHTML:'página mais recente'};
   await renderAdminTraining(['treino-admin','modulo','ADM-01'],main,()=>++calls===1);
   assert.equal(main.innerHTML,'página mais recente');assert.deepEqual(db.writes,[]);
 }finally{if(prev===undefined)delete globalThis.localStorage;else globalThis.localStorage=prev;}
});
