/** Fase 8B — Aproveitamento do módulo com overlay de evidências do motor novo.
 * Sempre há UMA fonte de base (importada, legado ou nenhuma). Atividades novas
 * substituem o estado efetivo da mesma etapa; não são somadas como duplicatas.
 * Exercícios e Banco continuam congelados na fonte original até a Fase 8C.
 */
import {calculatePartialAchievement} from './admin-pedagogy.js';
import {validateSharedActivityState} from './shared-activity-store.js';
const ratings={sei:100,duvida:50,nao:0};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const pct=(a,b)=>b?100*a/b:0;
export const ratingText=x=>({sei:'Eu sei',duvida:'Tenho dúvida',nao:'Não sei'}[x]??'Pendente');

export function calculateSharedModuleProgress(bundle,baselineProgress,baseAchievement,overlay){
 validateSharedActivityState(overlay,bundle.subjectId);
 const moduleId=bundle.moduleId;
 const base=obj(baselineProgress)?baselineProgress:{};
 const oldDiag=obj(base.diagnostics?.[moduleId]?.answers)?base.diagnostics[moduleId].answers:{};
 const newDiag=obj(overlay.diagnostics[moduleId]?.answers)?overlay.diagnostics[moduleId].answers:{};
 const oldLessons=obj(base.lessons)?base.lessons:{};
 const entries={};let diagRated=0,diagSum=0,lessonsDone=0,lessonsRated=0,lessonSum=0;
 const allowedDiag=new Set(bundle.diagnostic.map(x=>x.subtopicId));
 const lessonIds=Object.keys(bundle.lessons);
 const changedIds=new Set([...Object.keys(newDiag),...Object.keys(overlay.lessons).filter(x=>x.startsWith(moduleId+'-'))]);
 for(const topic of bundle.subtopics){
   const id=topic.id,srcLesson=obj(oldLessons[id])?oldLessons[id]:{},newLesson=obj(overlay.lessons[id])?overlay.lessons[id]:{};
   const diagnostic=allowedDiag.has(id)?(own(newDiag,id)?newDiag[id]:oldDiag[id]):null;
   const completed=!!bundle.lessons[id]&&(srcLesson.completed===true||newLesson.completed===true);
   const lessonRating=!!bundle.lessons[id]?(own(newLesson,'rating')?newLesson.rating:srcLesson.rating):null;
   const diagnosticOrigin=own(newDiag,id)?'novo':own(oldDiag,id)?'herdado':'nenhum';
   const lessonOrigin=own(newLesson,'rating')||newLesson.completed===true?'novo':(srcLesson.completed===true||own(srcLesson,'rating'))?'herdado':'nenhum';
   if(allowedDiag.has(id)&&own(ratings,diagnostic)){diagRated++;diagSum+=ratings[diagnostic];}
   if(completed)lessonsDone++;
   if(own(ratings,lessonRating)){lessonsRated++;lessonSum+=ratings[lessonRating];}
   entries[id]={id,title:topic.title,hasLesson:!!bundle.lessons[id],hasDiagnostic:allowedDiag.has(id),
     diagnostic:own(ratings,diagnostic)?diagnostic:null,completed,
     lessonRating:own(ratings,lessonRating)?lessonRating:null,diagnosticOrigin,lessonOrigin};
 }
 const oldComponents=baseAchievement?.components??{};
 const components={};
 if(diagRated)components.diagnostic={available:true,score:diagSum/diagRated,coverage:pct(diagRated,bundle.diagnostic.length)};
 if(lessonsDone)components.lessonCompletion={available:true,score:100,coverage:pct(lessonsDone,lessonIds.length)};
 if(lessonsRated)components.lessonSelfAssessment={available:true,score:lessonSum/lessonsRated,coverage:pct(lessonsRated,lessonIds.length)};
 for(const kind of ['exercises','bank']){
   const old=oldComponents[kind];
   if(old?.available===true)components[kind]={available:true,score:old.score,coverage:old.coverage};
 }
 // Sem nova evidência, mantém os resultados herdados exatos, inclusive critérios
 // de sessões antigas aceitos pelo índice da Fase 7C.
 const result=changedIds.size?calculatePartialAchievement(components):
   (baseAchievement??calculatePartialAchievement({}));
 return {...result,moduleId,sourceChanged:changedIds.size>0,
   evidence:{diagnostics:diagRated,diagnosticsTotal:bundle.diagnostic.length,
     lessonsDone,lessonsRated,lessonsTotal:lessonIds.length},subtopics:entries,
   frozenStages:['exercises','bank']};
}
