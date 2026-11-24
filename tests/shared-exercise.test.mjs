import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrainingState,recordTrainingAttempt,summarizeTraining,reviewEntries} from '../site/js/unificado/training-engine.js';
import {selectExerciseQuestions,startLearningExercise,answerLearningExercise,assessLearningExercise,
 nextLearningExercise,exerciseSessionSummary,validateExerciseSessions} from '../site/js/unificado/shared-exercise-engine.js';
import {calculateSharedModuleProgress} from '../site/js/unificado/shared-progress.js';
import {createSharedActivityState} from '../site/js/unificado/shared-activity-store.js';
import {renderSharedExercises,handleSharedExerciseClick} from '../site/js/unificado/shared-exercise-ui.js';
import {trainingKeyFor} from '../site/js/unificado/training-store.js';
const at='2026-11-24T18:00:00.000Z',id='ADM-01';
const questions=Array.from({length:15},(_,i)=>({id:`Q-${id}-${String(i).padStart(3,'0')}`,moduleId:id,
 subtopicId:`${id}-00${i%3+1}`,difficulty:i<9?'media':'dificil',type:'classica',
 options:['Não','Sim','Talvez'],answer:i%3,stem:'Enunciado '+i,explanation:'Fundamento '+i}));
const state=()=>createTrainingState(at);
const bundle={subjectId:'administracao',moduleId:id,lessons:{'ADM-01-001':{id:'ADM-01-001'}},
 subtopics:[{id:'ADM-01-001',title:'Tema 1'}],diagnostic:[{subtopicId:'ADM-01-001'}]};
const shared=()=>createSharedActivityState('administracao',{now:at});
const db=seed=>{const map=new Map(Object.entries(seed??{})),writes=[];return {getItem:k=>map.get(k)??null,
 setItem:(k,v)=>{writes.push(k);map.set(k,String(v))},removeItem:k=>{writes.push(k);map.delete(k)},writes,map};};
const plan=()=>selectExerciseQuestions(questions,id,{random:()=>0.5});
const start=(s=state())=>{startLearningExercise(s,questions,id,{now:at,random:()=>0.5});return s};

test('seleção mantém todas as médias e seleciona exatamente seis difíceis sem ID repetido',()=>{
 const list=plan();assert.equal(list.length,15);assert.equal(new Set(list.map(q=>q.id)).size,15);
 assert.equal(list.filter(q=>q.difficulty==='media').length,9);
 assert.equal(list.filter(q=>q.difficulty==='dificil').length,6);
});
test('sorteio inválido e catálogo duplicado são bloqueados',()=>{
 assert.throws(()=>selectExerciseQuestions(questions,id,{random:()=>1}),/Sorteio inválido/);
 assert.throws(()=>selectExerciseQuestions([...questions,questions[0]],id),/repetida/);
 assert.throws(()=>selectExerciseQuestions(questions.slice(0,5),id),/pelo menos 6/);
});
test('cria e retoma sessão sem novas tentativas',()=>{
 const s=start();assert.equal(s.exerciseSessions[id].ids.length,15);assert.equal(Object.keys(s.questions).length,0);
 assert.equal(s.exerciseSessions[id].finishedAt,null);
 assert.throws(()=>startLearningExercise(s,questions,id),/em andamento/);
});
test('responder uma vez registra UMA tentativa com origem exercício',()=>{
 const s=start(),q=questions.find(x=>x.id===s.exerciseSessions[id].ids[0]);
 const result=answerLearningExercise(s,q,q.answer,{now:at});assert.equal(result.correct,true);
 assert.equal(s.questions[q.id].attempts,1);
 assert.equal(s.questions[q.id].history[0].source,'exercise');
 assert.throws(()=>answerLearningExercise(s,q,q.answer),/já foi respondida/);
});
test('exercícios e Banco compartilham o mesmo registro por ID, sem contar duas distintas',()=>{
 const s=state(),q=questions[0];recordTrainingAttempt(s,q,q.answer,{source:'bank',now:at});
 startLearningExercise(s,questions,id,{now:at,random:()=>0.5});
 // encontra a questão do Banco navegando pela sessão artificial, sem alterar a seleção persistida
 const ses=s.exerciseSessions[id];ses.cursor=ses.ids.indexOf(q.id);
 answerLearningExercise(s,q,q.answer,{now:at});
 assert.equal(summarizeTraining(s).distinct,1);assert.equal(s.questions[q.id].attempts,2);
 assert.equal(summarizeTraining(s).bySource.bank,1);
 assert.equal(summarizeTraining(s).bySource.exercise,1);
});
test('não permite avançar sem avaliação e não aceita razão incompatível',()=>{
 const s=start(),q=questions.find(x=>x.id===s.exerciseSessions[id].ids[0]);
 assert.throws(()=>nextLearningExercise(s,id),/autoavalie/);
 answerLearningExercise(s,q,q.answer,{now:at});
 assert.throws(()=>assessLearningExercise(s,q,'desconhecimento',{now:at}),/não corresponde/);
 assert.throws(()=>nextLearningExercise(s,id),/autoavalie/);
});
test('acerto com dúvida agenda revisão em 3 dias sem criar erro fictício',()=>{
 const s=start(),q=questions.find(x=>x.id===s.exerciseSessions[id].ids[0]);
 answerLearningExercise(s,q,q.answer,{now:at});
 const rec=assessLearningExercise(s,q,'duvida',{now:at});
 assert.equal(rec.intervalDays,3);assert.equal(s.questions[q.id].everWrong,false);
 assert.equal(s.questions[q.id].reviewEligible,true);
 assert.equal(reviewEntries(s,{now:'2026-11-27T18:00:01.000Z'}).length,1);
 assert.equal(summarizeTraining(s,{now:'2026-11-27T18:00:01.000Z'}).wrongQuestions,0);
 assert.throws(()=>assessLearningExercise(s,q,'duvida',{now:at}),/já registrada/);
});
test('erro por pegadinha agenda revisão em dois dias',()=>{
 const s=start(),q=questions.find(x=>x.id===s.exerciseSessions[id].ids[0]);
 const selected=(q.answer+1)%q.options.length;
 answerLearningExercise(s,q,selected,{now:at});
 const result=assessLearningExercise(s,q,'pegadinha',{now:at});
 assert.equal(result.intervalDays,2);assert.equal(s.questions[q.id].everWrong,true);
 assert.equal(s.questions[q.id].history[0].assessment,'pegadinha');
});
test('sessão finalizada contém todas respostas e avaliações e permite nova seleção',()=>{
 const s=start();let i=0;
 while(!s.exerciseSessions[id].finishedAt){
  const ses=s.exerciseSessions[id],q=questions.find(q=>q.id===ses.ids[ses.cursor]);
  answerLearningExercise(s,q,q.answer,{now:at});assessLearningExercise(s,q,'seguro',{now:at});
  nextLearningExercise(s,id,{now:at});i++;assert.ok(i<=15);
 }
 assert.equal(exerciseSessionSummary(s,id,questions).answered,15);
 assert.equal(exerciseSessionSummary(s,id,questions).finished,true);
 const before=summarizeTraining(s).attempts;
 startLearningExercise(s,questions,id,{now:at,random:()=>0.5});
 assert.equal(summarizeTraining(s).attempts,before);
 assert.equal(exerciseSessionSummary(s,id,questions).answered,0);
});
test('corrupção de sessão não é silenciosamente substituída',()=>{
 const s=start();s.exerciseSessions[id].answers['Q-NAO-EXISTE']=0;
 assert.throws(()=>validateExerciseSessions(s),/Respostas ou autoavaliações/);
});
test('nota de exercício parcial substitui componente anterior sem somar duas vezes',()=>{
 const s=start(),q=questions.find(q=>q.id===s.exerciseSessions[id].ids[0]);
 answerLearningExercise(s,q,q.answer,{now:at});
 const old={earnedWeightedPoints:24,hasData:true,components:{exercises:{available:true,score:80,coverage:100}}};
 const score=calculateSharedModuleProgress(bundle,{},old,shared(),{training:s,questions});
 assert.equal(score.components.exercises.points,2);
 assert.equal(score.earnedWeightedPoints,2);
 assert.equal(score.liveExercise.answered,1);
 assert.equal(score.frozenStages.includes('exercises'),false);
});
test('nota herdada permanece intacta sem respostas na nova sessão',()=>{
 const s=start();const old={earnedWeightedPoints:24,hasData:true,components:{exercises:{available:true,score:80,coverage:100}}};
 const score=calculateSharedModuleProgress(bundle,{},old,shared(),{training:s,questions});
 assert.equal(score.earnedWeightedPoints,24);
 assert.equal(score.liveExercise.answered,0);
});
test('Banco novo só computa 20 pontos quando não há componente herdado',()=>{
 const s=state();recordTrainingAttempt(s,questions[0],questions[0].answer,{source:'bank',now:at});
 const x=calculateSharedModuleProgress(bundle,{},null,shared(),{training:s,questions});
 assert.equal(x.components.bank.points,20);assert.equal(x.liveBank.applied,true);
 const old={earnedWeightedPoints:15,hasData:true,components:{bank:{available:true,score:75,coverage:100}}};
 const y=calculateSharedModuleProgress(bundle,{},old,shared(),{training:s,questions});
 assert.equal(y.earnedWeightedPoints,15);assert.equal(y.liveBank.applied,false);
});
test('simulado, Banco e revisão permanecem nas mesmas funções e esquema v1',()=>{
 const s=start();const q=questions[2];recordTrainingAttempt(s,q,q.answer,{source:'exam',now:at});
 recordTrainingAttempt(s,q,q.answer,{source:'review',now:at});
 const tot=summarizeTraining(s);assert.equal(tot.distinct,1);assert.equal(tot.attempts,2);
 assert.equal(tot.bySource.exam,1);assert.equal(tot.bySource.review,1);
});
test('renderização do exercício esconde gabarito antes de responder',async()=>{
 const output=await renderSharedExercises(bundle,{locked:false},{questionLoader:async()=>questions,storage:db()});
 assert.match(output,/Começar atividade/);assert.doesNotMatch(output,/Gabarito:/);
});
test('renderização mostra correção e autoavaliação após responder',async()=>{
 const s=start(),q=questions.find(q=>q.id===s.exerciseSessions[id].ids[0]);
 answerLearningExercise(s,q,q.answer,{now:at});
 const output=await renderSharedExercises(bundle,{locked:false},{questionLoader:async()=>questions,storage:db({[trainingKeyFor('administracao')]:JSON.stringify(s)})});
 assert.match(output,/Gabarito:/);assert.match(output,/Acertei com segurança/);
});
test('renderização de origem bloqueada não permite iniciar sessão',async()=>{
 const html=await renderSharedExercises(bundle,{locked:true,reason:'fonte alterada'},{questionLoader:async()=>questions,storage:db()});
 assert.match(html,/fonte alterada/);assert.doesNotMatch(html,/data-shared-exercise="start"/);
});
test('a operação grava só a chave de treino e preserva a origem administrativa',async()=>{
 const dbLocal=db({'admEstudo.v2.state':'BASE-TESTE'});
 const restore=globalThis.location;globalThis.location={hash:'#estudo/administracao/ADM-01/exercicios'};
 const btn={dataset:{sharedExercise:'start'},closest:()=>btn};
 try{await handleSharedExerciseClick({target:btn},async()=>{}, {
  storage:dbLocal,questionLoader:async()=>questions,moduleLoader:async()=>bundle,
  viewLoader:async()=>({locked:false}),baselineReader:()=>({source:'legacy',raw:'BASE-TESTE'})
 });
 assert.deepEqual(dbLocal.writes,[trainingKeyFor('administracao')]);
 assert.equal(dbLocal.getItem('admEstudo.v2.state'),'BASE-TESTE');
 assert.equal(dbLocal.getItem('estudoConcursos.v1.shared-activities.administracao'),null);
 }finally{globalThis.location=restore;}
});
test('uma mudança na origem bloqueia o salvamento sem apagar respostas',async()=>{
 const s=start();s.exerciseBaseline={source:'none',digest:'none'};
 const dbLocal=db({[trainingKeyFor('administracao')]:JSON.stringify(s)});
 const restore=globalThis.location;globalThis.location={hash:'#estudo/administracao/ADM-01/exercicios'};
 const btn={dataset:{sharedExercise:'next'},closest:()=>btn};
 try{await assert.rejects(()=>handleSharedExerciseClick({target:btn},async()=>{}, {
  storage:dbLocal,questionLoader:async()=>questions,moduleLoader:async()=>bundle,
  viewLoader:async()=>({locked:false}),baselineReader:()=>({source:'legacy',raw:'BASE-TESTE'})
 }),/origem dos exercícios mudou/);
 assert.deepEqual(dbLocal.writes,[]);
 }finally{globalThis.location=restore;}
});
test('autoavaliação de exercício funciona após responder a mesma questão no Banco',()=>{
 const s=start(),q=questions.find(q=>q.id===s.exerciseSessions[id].ids[0]);
 answerLearningExercise(s,q,q.answer,{now:at});
 recordTrainingAttempt(s,q,q.answer,{source:'bank',now:at});
 assert.equal(assessLearningExercise(s,q,'seguro',{now:at}).intervalDays,7);
 assert.equal(s.questions[q.id].history[0].assessment,'seguro');
 assert.equal(s.questions[q.id].history[1].assessment,undefined);
});
test('salvamento rejeita mudança da origem antes da gravação final',async()=>{
 const dbLocal=db({'admEstudo.v2.state':'ORIGEM'}),key=trainingKeyFor('administracao');
 const restore=globalThis.location;globalThis.location={hash:'#estudo/administracao/ADM-01/exercicios'};
 const btn={dataset:{sharedExercise:'start'},closest:()=>btn};
 let reads=0;
 const baselineReader=()=>{reads++;if(reads===3)dbLocal.map.set('admEstudo.v2.state','ORIGEM-ALTERADA');
  return {source:'legacy',raw:dbLocal.getItem('admEstudo.v2.state')};};
 try{await assert.rejects(()=>handleSharedExerciseClick({target:btn},async()=>{}, {
  storage:dbLocal,questionLoader:async()=>questions,moduleLoader:async()=>bundle,
  viewLoader:async()=>({locked:false}),baselineReader
 }),/origem pedagógica mudou|fonte de estudo mudou/);
 assert.equal(dbLocal.getItem(key),null);
 }finally{globalThis.location=restore;}
});
