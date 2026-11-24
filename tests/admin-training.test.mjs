/** Fase 6 — testes técnicos isolados. Nunca revisam o conteúdo pedagógico das questões. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 TRAINING_KEY,createTrainingState,validateTrainingState,recordTrainingAttempt,summarizeTraining,
 reviewEntries,selectExamQuestions,createExam,answerExam,navigateExam,finishExam
} from '../site/js/unificado/training-engine.js';
import {readTrainingState,updateTrainingState} from '../site/js/unificado/training-store.js';

const Q=(id,moduleId='ADM-01',answer=1)=>({id,moduleId,stem:'Questão sintética',options:['Opção A','Opção B','Opção C'],answer});
const d1='2026-11-20T10:00:00.000Z', d2='2026-11-22T10:00:00.000Z';
function storage(initial={}) {const db=new Map(Object.entries(initial));return {
 getItem:k=>db.has(k)?db.get(k):null,setItem:(k,v)=>db.set(k,String(v)),removeItem:k=>db.delete(k),
 entries:()=>Object.fromEntries(db)
}}

test('estado vazio válido e chave diferente da Administração original',()=>{
 const s=createTrainingState(d1);
 assert.equal(validateTrainingState(s),s);
 assert.notEqual(TRAINING_KEY,'admEstudo.v2.state');
 assert.equal(s.subjectId,'administracao');
});
test('uma resposta incorreta entra no histórico e agenda revisão sem alterar gabarito',()=>{
 const state=createTrainingState(d1),q=Q('Q-ADM-01-001');
 const original=structuredClone(q);
 const out=recordTrainingAttempt(state,q,0,{now:d1});
 assert.equal(out.correct,false);assert.equal(state.questions[q.id].attempts,1);
 assert.equal(state.questions[q.id].dueAt,'2026-11-21T10:00:00.000Z');
 assert.deepEqual(q,original);
 assert.equal(reviewEntries(state,{now:d2}).length,1);
});
test('acerto inicial não produz erro nem revisão; respostas subsequentes preservam o histórico',()=>{
 const s=createTrainingState(d1),q=Q('Q-ADM-01-BBB');
 recordTrainingAttempt(s,q,1,{now:d1});
 assert.equal(s.questions[q.id].dueAt,null);
 recordTrainingAttempt(s,q,0,{now:d2,source:'review'});
 assert.equal(s.questions[q.id].correct,1);
 assert.equal(s.questions[q.id].attempts,2);
 assert.equal(s.questions[q.id].history.length,2);
});
test('revisões: revisão de erro vencido aumenta intervalo após acerto',()=>{
 const s=createTrainingState(d1),q=Q('Q-ADM-01-CCC');
 recordTrainingAttempt(s,q,0,{now:d1});recordTrainingAttempt(s,q,1,{now:d2,source:'review'});
 assert.equal(s.questions[q.id].streak,1);
 assert.equal(s.questions[q.id].dueAt,'2026-11-25T10:00:00.000Z');
 assert.equal(reviewEntries(s,{now:d2}).length,0);
 assert.equal(reviewEntries(s,{now:d2,dueOnly:false}).length,1);
});
test('estatísticas separam distintos, tentativas, acertos e módulos',()=>{
 const s=createTrainingState(d1);
 recordTrainingAttempt(s,Q('Q-ADM-01-A'),1,{now:d1});
 recordTrainingAttempt(s,Q('Q-ADM-01-A'),0,{now:d1});
 recordTrainingAttempt(s,Q('Q-DA-17-B','DA-17',0),0,{now:d1});
 const stats=summarizeTraining(s,{now:d2});
 assert.equal(stats.distinct,2);assert.equal(stats.attempts,3);assert.equal(stats.correct,2);
 assert.equal(stats.accuracy,67);assert.equal(stats.wrongQuestions,1);
 assert.equal(stats.due,1);
 assert.equal(stats.modules['ADM-01'].attempts,2);
});
test('simulado geral sorteia 20 itens únicos usando até dez dos 27 módulos',async()=>{
 const ids=[...Array.from({length:12},(_,i)=>`ADM-${String(i+1).padStart(2,'0')}`),'AP-13','AP-14',...Array.from({length:13},(_,i)=>`DA-${String(i+15).padStart(2,'0')}`)];
 const manifest={modules:ids.map(id=>({id,count:30}))};let calls=[];
 const questions=await selectExamQuestions(manifest,async id=>{calls.push(id);return Array.from({length:30},(_,i)=>Q(`Q-${id}-${i}`,id))}, {random:()=>0.5});
 assert.equal(questions.length,20);assert.equal(new Set(questions.map(q=>q.id)).size,20);
 assert.ok(calls.length<=10);assert.ok(calls.length>=1);assert.equal(new Set(calls).size,calls.length);
});
test('simulado de um módulo carrega apenas o módulo escolhido e recusa poucas questões',async()=>{
 const manifest={modules:[{id:'ADM-01',count:24},{id:'DA-17',count:10}]};let called=[];
 const loader=async id=>{called.push(id);return Array.from({length:id==='ADM-01'?24:10},(_,i)=>Q(`Q-${id}-${i}`,id))};
 assert.equal((await selectExamQuestions(manifest,loader,{scope:'module',moduleId:'ADM-01'})).length,20);
 assert.deepEqual(called,['ADM-01']);
 await assert.rejects(()=>selectExamQuestions(manifest,loader,{scope:'module',moduleId:'DA-17'}),/suficientes/);
});
test('simulado salva respostas parciais, permite alterá-las e só registra na finalização',()=>{
 const s=createTrainingState(d1);const questions=[Q('Q-ADM-01-A'),Q('Q-DA-17-B','DA-17')];
 createExam(s,questions,{now:d1});
 assert.equal(s.questions['Q-ADM-01-A'],undefined);
 answerExam(s,'Q-ADM-01-A',1,questions);navigateExam(s,1);answerExam(s,'Q-DA-17-B',1,questions);
 answerExam(s,'Q-DA-17-B',0,questions);
 assert.throws(()=>finishExam(s,questions.slice(0,1),{now:d2}),/Responda todas/);
 assert.ok(s.session);
 const score=finishExam(s,questions,{now:d2});
 assert.equal(score.correct,1);assert.equal(score.total,2);assert.equal(score.score,50);
 assert.equal(s.session,null);assert.equal(s.simulations.length,1);
 assert.equal(s.questions['Q-DA-17-B'].lastAnswer,0);
});
test('simulado preserva módulo de IDs que não têm prefixo do módulo',()=>{
 const s=createTrainingState(d1),q=Q('Q-F25-L09-LISTA2-001','DA-17');
 createExam(s,[q],{scope:'module',moduleId:'DA-17',now:d1});
 assert.equal(s.session.moduleIds[q.id],'DA-17');
});
test('histórico de treino nunca sobrescreve chave original e mantém dados entre leituras',()=>{
 const old='{"schemaVersion":3,"progress":{"questions":{"id":"antigo"}}}';
 const db=storage({'admEstudo.v2.state':old});
 const r=updateTrainingState(s=>recordTrainingAttempt(s,Q('Q-ADM-01-AAA'),0,{now:d1}),db);
 assert.equal(r.ok,true);assert.equal(db.getItem('admEstudo.v2.state'),old);
 assert.equal(readTrainingState(db).state.questions['Q-ADM-01-AAA'].attempts,1);
 assert.equal(db.getItem(TRAINING_KEY).includes('Q-ADM-01-AAA'),true);
});
test('gravação bloqueia conflito de outra aba sem sobrescrever o valor mais recente',()=>{
 let raw=null;const external='{"mudanca":"externa"}';
 const db={getItem:()=>raw,setItem:(_k,v)=>{raw=v}};
 const r=updateTrainingState(state=>{state.metadata.updatedAt=d1;raw=external},db);
 assert.equal(r.ok,false);assert.match(r.message,/outra aba/);assert.equal(raw,external);
});
test('estado corrompido é preservado, não substituído por estado vazio',()=>{
 const db=storage({[TRAINING_KEY]:'{inválido'});
 const r=updateTrainingState(s=>{s.simulations=[]},db);
 assert.equal(r.ok,false);assert.equal(db.getItem(TRAINING_KEY),'{inválido');
});
test('não aceita módulo adulterado, resposta fora das opções e duplicidade na seleção',()=>{
 const s=createTrainingState(d1),q=Q('Q-ADM-01-DDD');
 assert.throws(()=>recordTrainingAttempt(s,q,20),/inválida/);
 recordTrainingAttempt(s,q,0,{now:d1});
 assert.throws(()=>recordTrainingAttempt(s,Q('Q-ADM-01-DDD','DA-17'),0),/mudou de módulo/);
 assert.throws(()=>createExam(s,[q,q]),/Seleção inválida/);
});
test('roteamento do portal leva ao novo motor sem modificar o ADM original',()=>{
 const app=readFileSync(new URL('../site/js/unificado/app.js',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../site/js/unificado/admin-training-ui.js',import.meta.url),'utf8');
 assert.match(app,/renderAdminTraining\(route,main/);
 assert.match(app,/#treino-admin/);
 assert.match(ui,/Banco de questões/);
 assert.match(ui,/Simulado de 20 questões/);
 assert.match(ui,/Estatísticas da nova área/);
 assert.match(ui,/estudoConcursos\.v1\.training\.administracao/);
 assert.doesNotMatch(ui,/localStorage\.setItem\('admEstudo\.v2\.state'/);
});

test('núcleo reutilizável: progresso de Português isolado do progresso de Administração',async()=>{
 const {createTrainingStore}=await import('../site/js/unificado/training-store.js');
 const db=storage({'admEstudo.v2.state':'legado-preservado'});
 const portuguese=createTrainingStore('portugues');
 const r=portuguese.update(s=>recordTrainingAttempt(s,Q('Q-POR-01-AA','POR-01'),1,{now:d1}),db);
 assert.equal(r.ok,true);
 assert.equal(portuguese.key,'estudoConcursos.v1.training.portugues');
 assert.equal(portuguese.read(db).state.subjectId,'portugues');
 assert.equal(db.getItem(TRAINING_KEY),null);
 assert.equal(db.getItem('admEstudo.v2.state'),'legado-preservado');
});

test('gravação bloqueia tentativa de trocar identificador de disciplina do próprio estado',async()=>{
 const {createTrainingStore}=await import('../site/js/unificado/training-store.js');
 const db=storage();const portuguese=createTrainingStore('portugues');
 const result=portuguese.update(s=>{s.subjectId='administracao';},db);
 assert.equal(result.ok,false);assert.equal(db.getItem(portuguese.key),null);
});
