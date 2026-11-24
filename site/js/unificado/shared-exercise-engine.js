/** Fase 8C — sessões de exercícios de aprendizagem reutilizáveis.
 * Dados ficam no histórico de treino v1, na mesma coleção de tentativas de banco,
 * revisão e simulado. A pontuação pedagógica continua DERIVADA, não persistida.
 */
import {recordTrainingAttempt,validateQuestion,validateTrainingState} from './training-engine.js';
const MODULE=/^[A-Z]{2,5}-\d{2,3}$/;
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const reasons={seguro:7,duvida:3,chute:1,desconhecimento:1,pegadinha:2,interpretacao:2,desatencao:3};
export const EXERCISE_REASONS=Object.freeze({
 seguro:'Acertei com segurança',duvida:'Acertei com dúvida',chute:'Acertei chutando',
 desconhecimento:'Errei por desconhecimento',pegadinha:'Errei por pegadinha',
 interpretacao:'Errei por interpretação',desatencao:'Errei por desatenção'
});
const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const shuffle=(a,random=Math.random)=>{
 const out=[...a];for(let i=out.length-1;i>0;i--){let u=random();
  if(!Number.isFinite(u)||u<0||u>=1)throw Error('Sorteio inválido.');
  const j=Math.floor(u*(i+1));[out[i],out[j]]=[out[j],out[i]];
 }return out;
};
export function selectExerciseQuestions(questions,moduleId,{random=Math.random}={}){
 if(!MODULE.test(moduleId)||!Array.isArray(questions))throw Error('Módulo ou catálogo de exercícios inválido.');
 const ids=new Set();for(const q of questions){validateQuestion(q);
  if(q.moduleId!==moduleId||ids.has(q.id))throw Error('Questão repetida ou fora do módulo.');ids.add(q.id);
 }
 const medium=questions.filter(q=>q.difficulty==='media');
 const difficult=shuffle(questions.filter(q=>q.difficulty==='dificil'),random);
 if(!medium.length||difficult.length<6)throw Error('O módulo precisa ter questões médias e pelo menos 6 difíceis para esta atividade.');
 // Mesmo critério do ADM-ESTUDO: todas as médias + 6 difíceis, diversificando subtópicos.
 const selected=[],usedTopics=new Set();
 for(const q of difficult){const id=q.subtopicId||'sem-subtopico';if(!usedTopics.has(id)){
  selected.push(q);usedTopics.add(id);if(selected.length===6)break;
 }}
 for(const q of difficult){if(selected.length===6)break;if(!selected.includes(q))selected.push(q);}
 return shuffle([...medium,...selected],random);
}
export function validateExerciseSessions(state){
 validateTrainingState(state);
 const sessions=state.exerciseSessions??{};
 if(!object(sessions))throw Error('Sessões de exercícios incompatíveis.');
 for(const [id,s] of Object.entries(sessions)){
  if(!MODULE.test(id)||!object(s)||!Array.isArray(s.ids)||!s.ids.length||new Set(s.ids).size!==s.ids.length||
   !object(s.answers)||!object(s.assessments)||!Number.isInteger(s.cursor)||s.cursor<0||s.cursor>=s.ids.length||
   !validDate(s.startedAt)||!(s.finishedAt===null||validDate(s.finishedAt)))throw Error('Sessão de exercício inválida.');
  if(Object.keys(s.answers).some(q=>!s.ids.includes(q)||!Number.isInteger(s.answers[q])||s.answers[q]<0)||
     Object.keys(s.assessments).some(q=>!has(s.answers,q)||!has(reasons,s.assessments[q]?.reason)))
    throw Error('Respostas ou autoavaliações de exercício inválidas.');
  if(s.finishedAt && s.ids.some(q=>!has(s.answers,q)||!has(s.assessments,q)))
    throw Error('Exercício concluído sem todas as avaliações.');
 }
 return sessions;
}
export function startLearningExercise(state,questions,moduleId,{now=new Date().toISOString(),random=Math.random}={}){
 const sessions=validateExerciseSessions(state);
 if(!validDate(now))throw Error('Data inválida.');
 if(sessions[moduleId]&&!sessions[moduleId].finishedAt)throw Error('Existe uma atividade em andamento; conclua antes de começar outra.');
 const selected=selectExerciseQuestions(questions,moduleId,{random});
 state.exerciseSessions??={};
 const s={ids:selected.map(q=>q.id),cursor:0,answers:{},assessments:{},startedAt:now,finishedAt:null};
 state.exerciseSessions[moduleId]=s;return s;
}
export function answerLearningExercise(state,question,selected,{now=new Date().toISOString()}={}){
 const sessions=validateExerciseSessions(state);validateQuestion(question);
 const s=sessions[question.moduleId];
 if(!s||s.finishedAt||s.ids[s.cursor]!==question.id||has(s.answers,question.id))throw Error('Questão não está disponível ou já foi respondida.');
 const r=recordTrainingAttempt(state,question,selected,{source:'exercise',now});
 s.answers[question.id]=selected;return r;
}
export function assessLearningExercise(state,question,reason,{now=new Date().toISOString()}={}){
 const sessions=validateExerciseSessions(state);validateQuestion(question);
 const s=sessions[question.moduleId],id=question.id;
 if(!s||s.finishedAt||s.ids[s.cursor]!==id||!has(s.answers,id)||has(s.assessments,id)||!has(reasons,reason)||!validDate(now))
  throw Error('Avaliação de exercício inválida ou já registrada.');
 const correct=s.answers[id]===question.answer;
 if(!((correct&&['seguro','duvida','chute'].includes(reason))||(!correct&&['desconhecimento','pegadinha','interpretacao','desatencao'].includes(reason))))
  throw Error('A avaliação não corresponde ao resultado da questão.');
 const dueAt=new Date(Date.parse(now)+reasons[reason]*86400000).toISOString();
 s.assessments[id]={reason,correct,at:now,dueAt,intervalDays:reasons[reason]};
 const rec=state.questions[id];
 const attempt=rec?.history?.filter(h=>h.source==='exercise').at(-1);
 if(!attempt||attempt.answer!==s.answers[id]||attempt.assessment)throw Error('Tentativa de exercício não localizada.');
 rec.reviewEligible=true;rec.dueAt=dueAt;attempt.assessment=reason;
 return s.assessments[id];
}
export function nextLearningExercise(state,moduleId,{now=new Date().toISOString()}={}){
 const sessions=validateExerciseSessions(state),s=sessions[moduleId];if(!s||s.finishedAt||!validDate(now))throw Error('Atividade indisponível.');
 const id=s.ids[s.cursor];if(!has(s.answers,id)||!has(s.assessments,id))throw Error('Responda e autoavalie esta questão antes de continuar.');
 if(s.cursor===s.ids.length-1)s.finishedAt=now;
 else s.cursor++;
 return s;
}
export function exerciseSessionSummary(state,moduleId,questions){
 const sessions=validateExerciseSessions(state),s=sessions[moduleId];
 if(!s)return null;
 const lookup=new Map(questions.map(q=>[q.id,q]));
 if(s.ids.some(id=>!lookup.has(id)||lookup.get(id).moduleId!==moduleId))throw Error('Sessão antiga incompatível com o catálogo atual.');
 let answered=0,correct=0;for(const id of s.ids){if(has(s.answers,id)){
   const q=lookup.get(id);if(s.answers[id]>=q.options.length)throw Error('Resposta fora das alternativas atuais.');
   answered++;if(s.answers[id]===q.answer)correct++;
 }}
 return {total:s.ids.length,answered,assessed:Object.keys(s.assessments).length,correct,finished:!!s.finishedAt,cursor:s.cursor};
}
