/**
 * ESTUDO-CONCURSOS — Fase 7D.
 * Projeção SOMENTE LEITURA dos módulos administrativos para a interface nova.
 * - O aproveitamento herdado vem de UMA única fonte: cópia pedagógica F7C,
 *   ou histórico ADM original, nunca dos dois simultaneamente.
 * - As tentativas no treino novo aparecem SEPARADAS e não entram na nota de 75.
 * - Não grava no localStorage nem altera estados de origem.
 */
import {validatePedagogyIndex,modulePedagogy,calculatePartialAchievement,
  PEDAGOGY_SNAPSHOT_FORMAT} from './admin-pedagogy.js';
import {validateLegacyState} from './legacy-compat.js';
import {validateTrainingState} from './training-engine.js';

const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const ratings=Object.freeze({sei:'Eu sei',duvida:'Tenho dúvida',nao:'Não sei'});
const weights=Object.freeze({diagnostic:20,lessonCompletion:15,lessonSelfAssessment:15,exercises:30,bank:20});
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const plainNumber=x=>typeof x==='number'&&Number.isFinite(x);

/** Rejeita cópias de outro catálogo e de formato desconhecido, sem restaurá-las. */
export function assertCompatiblePedagogySnapshot(snapshot,index){
  if(!object(snapshot)||snapshot.format!==PEDAGOGY_SNAPSHOT_FORMAT||snapshot.schemaVersion!==1||
     snapshot.subjectId!=='administracao'||!object(snapshot.progress)||!object(snapshot.achievements)||
     !object(snapshot.metadata)||snapshot.metadata.catalogSha256!==index.catalogSha256||
     !validDate(snapshot.metadata.importedAt))
    throw Error('A cópia pedagógica importada não corresponde ao catálogo atual. Nenhum dado foi alterado. Confira a página Aproveitamento e preserve seu backup.');
  for(const kind of ['diagnostics','lessons','exercises'])
    if(!object(snapshot.progress[kind]))throw Error(`Cópia pedagógica incompleta: ${kind}. Nenhum registro foi alterado.`);
  const validModules=new Set(index.modules.map(m=>m.id));
  for(const [id,entry] of Object.entries(snapshot.achievements)){
    if(!validModules.has(id)||!object(entry)||entry.moduleId!==id||entry.hasData!==true||
      !plainNumber(entry.earnedWeightedPoints)||entry.earnedWeightedPoints<0||entry.earnedWeightedPoints>100||
      !object(entry.components)||!object(entry.evidence)||
      entry.percentage!==Math.floor(entry.earnedWeightedPoints+1e-8)||
      entry.completed!==(entry.earnedWeightedPoints>=75))
      throw Error(`Nota pedagógica importada incompatível em ${id}; nenhuma alteração realizada.`);
    let sum=0;
    for(const [component,weight] of Object.entries(weights)){
      const item=entry.components[component];
      if(!object(item)||item.weight!==weight||!plainNumber(item.points)||
         item.points<0||item.points>weight)throw Error(`Componente pedagógico incompatível: ${id}/${component}.`);
      sum+=item.points;
    }
    if(Math.abs(Math.round(sum*100)/100-entry.earnedWeightedPoints)>0.011)
      throw Error(`Soma pedagógica incompatível em ${id}.`);
  }
  return snapshot;
}

const none=()=>calculatePartialAchievement({});
function moduleTraining(training,moduleId,now){
  const entries=Object.entries(training.questions).filter(([,x])=>x.moduleId===moduleId);
  let attempts=0,correct=0,withErrors=0,due=0;
  for(const [,record] of entries){
    attempts+=record.attempts;correct+=record.correct;
    if(record.everWrong)withErrors++;
    if(record.everWrong&&validDate(record.dueAt)&&record.dueAt<=now)due++;
  }
  return {distinct:entries.length,attempts,correct,withErrors,due,
    accuracy:attempts?Math.round(100*correct/attempts):null};
}

function moduleSubtopics(module,progress){
  const ids=module.subtopicIds;
  const titles=new Map((Array.isArray(module.subtopics)?module.subtopics:[])
    .filter(x=>object(x)&&ids.includes(x.id)&&typeof x.title==='string')
    .map(x=>[x.id,x.title]));
  const diag=object(progress?.diagnostics?.[module.id]?.answers)?progress.diagnostics[module.id].answers:{};
  const lessons=object(progress?.lessons)?progress.lessons:{};
  const lessonIds=new Set(module.lessonIds),diagIds=new Set(module.diagnosticIds);
  return ids.map(id=>{
    const lesson=object(lessons[id])?lessons[id]:{};
    return {id,title:titles.get(id)||id,hasLesson:lessonIds.has(id),
      hasDiagnostic:diagIds.has(id),diagnostic:diagIds.has(id)&&own(ratings,diag[id])?diag[id]:null,
      lessonCompleted:lessonIds.has(id)&&lesson.completed===true,
      lessonRating:lessonIds.has(id)&&own(ratings,lesson.rating)?lesson.rating:null};
  });
}

/**
 * Os registros originais são consultados apenas na ausência de uma cópia F7C.
 * Caso uma cópia exista, NÃO recalcula sua pontuação com dados mais recentes
 * do ADM original, nem soma tentativas do treino novo.
 */
export function buildAdminModuleProgress(index,training,{legacy=null,imported=null,now=new Date().toISOString()}={}){
  validatePedagogyIndex(index);
  validateTrainingState(training,'administracao');
  if(legacy!==null)validateLegacyState(legacy);
  if(imported!==null)assertCompatiblePedagogySnapshot(imported,index);
  if(!validDate(now))throw Error('Data de consulta inválida.');
  const source=imported?'imported':legacy?'legacy':'none';
  const progress=imported?.progress??legacy?.progress??null;
  const snapshotDate=imported?.metadata?.importedAt??null;
  const legacyUpdated=legacy?.metadata?.updatedAt??null;
  const newerLegacy=source==='imported'&&legacy!==null&&validDate(legacyUpdated)&&legacyUpdated!==imported.metadata.sourceUpdatedAt;
  const rows=index.modules.map(module=>{
    const achievement=source==='imported'?(imported.achievements[module.id]??none()):
      source==='legacy'?modulePedagogy(legacy,module):none();
    // Nenhuma atividade = nota indefinida; não apresentar como 0% de aproveitamento.
    const hasData=achievement.hasData===true;
    const raw=object(progress?.exercises?.[module.id])?progress.exercises[module.id]:null;
    const exerciseIds=Array.isArray(raw?.ids)?raw.ids:[];
    const answers=object(raw?.answers)?raw.answers:{};
    const attempted=exerciseIds.filter(id=>Number.isInteger(answers[id])).length;
    return {id:module.id,title:module.title,area:module.area,
      questionsAvailable:module.bank.length,subtopics:moduleSubtopics(module,progress),
      source,sourceAt:source==='imported'?snapshotDate:source==='legacy'?legacyUpdated:null,
      sourceMayBeOlder:!!newerLegacy,hasData,
      earnedWeightedPoints:hasData?achievement.earnedWeightedPoints:null,
      percentage:hasData?achievement.percentage:null,
      coveragePercentage:hasData?achievement.coveragePercentage:null,
      completed:hasData&&achievement.earnedWeightedPoints>=75,
      components:achievement.components,
      exerciseSession:raw?{total:exerciseIds.length,answered:attempted,finished:!!raw.finishedAt}:null,
      // Indicador independente, nunca misturado ao aproveitamento herdado.
      training:moduleTraining(training,module.id,now)};
  });
  return {source,sourceAt:snapshotDate??legacyUpdated,sourceMayBeOlder:!!newerLegacy,
    rows,started:rows.filter(x=>x.hasData).length,atGoal:rows.filter(x=>x.completed).length};
}
export const ratingLabel=x=>ratings[x]??'Pendente';
