/** Fase 8B — adapta uma fonte do ADM-ESTUDO ao progresso comum, sem gravá-la. */
import {readLegacyState} from './legacy-compat.js';
import {readPedagogySnapshot,loadPedagogyIndex,modulePedagogy} from './admin-pedagogy.js';
import {assertCompatiblePedagogySnapshot} from './admin-module-progress.js';
import {readSharedActivityState,fingerprintBaseline,sameBaseline} from './shared-activity-store.js';
import {calculateSharedModuleProgress} from './shared-progress.js';
import {readTrainingState} from './training-store.js';
import {createTrainingState} from './training-engine.js';
import {loadAdminQuestions} from './admin-catalog.js';

export function readSharedBaseline(storage=globalThis.localStorage){
 if(!storage?.getItem)return {source:'none',raw:null,progress:{}};
 const imported=readPedagogySnapshot(storage);
 if(!imported.ok)throw Error(imported.message);
 if(imported.exists)return {source:'imported',raw:imported.raw,
   progress:imported.snapshot.progress,imported:imported.snapshot};
 const original=readLegacyState(storage);
 if(!original.ok)throw Error(original.message);
 if(original.exists)return {source:'legacy',raw:original.raw,progress:original.state.progress,legacy:original.state};
 return {source:'none',raw:null,progress:{}};
}
/**
 * Não mistura fontes. O SHA das chaves brutas é obrigatório para continuar a editar:
 * mudar a origem suspende novas gravações e a pontuação combinada.
 */
export async function buildSharedStudyView(bundle,{
 storage=globalThis.localStorage,indexLoader=loadPedagogyIndex
}={}){
 const activity=readSharedActivityState(bundle.subjectId,storage);
 if(!activity.ok)throw Error(activity.message);
 if(bundle.subjectId!=='administracao'){
   return {source:'none',sourceAt:null,locked:false,activity:activity.state,
     score:calculateSharedModuleProgress(bundle,{},null,activity.state)};
 }
 const baseline=readSharedBaseline(storage);
 const signature=await fingerprintBaseline(baseline);
 const trainRead=storage?.getItem?readTrainingState(storage):{ok:true,state:createTrainingState()};
 if(!trainRead.ok)return {source:baseline.source,locked:true,activity:activity.state,score:null,
   reason:'O histórico de tentativas está incompatível. Nenhum dado será alterado. '+trainRead.message};
 if(trainRead.state.exerciseBaseline&&!sameBaseline(trainRead.state.exerciseBaseline,signature))
   return {source:baseline.source,locked:true,activity:activity.state,score:null,
     reason:'A fonte pedagógica vinculada aos exercícios mudou. Preserve o backup e reconcilie antes de continuar.'};
 if(activity.state.baseline&&!sameBaseline(activity.state.baseline,signature)){
   return {source:baseline.source,locked:true,activity:activity.state,
     reason:'A fonte do progresso antigo mudou após o início das atividades no novo motor. A pontuação conjunta fica suspensa e novas gravações são bloqueadas. Guarde um backup e reconcilie os históricos antes de continuar.',
     score:null};
 }
 let original=null;
 if(baseline.source!=='none'){
   const index=await indexLoader();
   const module=index.modules.find(x=>x.id===bundle.moduleId);
   if(!module||module.lessonIds.length!==Object.keys(bundle.lessons).length||
     module.diagnosticIds.length!==bundle.diagnostic.length)throw Error('Pacotes de conteúdo e progresso diferentes; gravação suspensa.');
   if(baseline.source==='imported'){
     assertCompatiblePedagogySnapshot(baseline.imported,index);
     original=baseline.imported.achievements[bundle.moduleId]??null;
   }else original=modulePedagogy(baseline.legacy,module);
 }
 const training=trainRead.state;
 const needsQuestions=!!training.exerciseSessions?.[bundle.moduleId]||
   Object.values(training.questions).some(x=>x.moduleId===bundle.moduleId&&x.history.some(h=>h.source==='bank'));
 const questions=needsQuestions?await loadAdminQuestions(bundle.moduleId):[];
 const score=calculateSharedModuleProgress(bundle,baseline.progress,original,activity.state,{training,questions});
 return {source:baseline.source,sourceAt:baseline.source==='imported'?
   baseline.imported.metadata.importedAt:baseline.legacy?.metadata?.updatedAt??null,
   locked:false,activity:activity.state,score};
}
