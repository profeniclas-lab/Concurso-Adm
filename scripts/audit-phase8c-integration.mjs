/** Fase 8C — auditoria de integração com as questões REAIS da origem.
 * Compara o componente Exercícios com moduleAchievement() do ADM-ESTUDO;
 * confirma Banco, simulado e revisão numa coleção única, sem alterar dados pessoais.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {strict as assert} from 'node:assert';
import {buildParityFixture} from './audit-phase7e-parity.mjs';
import {createSharedActivityState} from '../site/js/unificado/shared-activity-store.js';
import {calculateSharedModuleProgress} from '../site/js/unificado/shared-progress.js';
import {createTrainingState,recordTrainingAttempt,summarizeTraining} from '../site/js/unificado/training-engine.js';
import {startLearningExercise,answerLearningExercise,assessLearningExercise,nextLearningExercise,
 exerciseSessionSummary} from '../site/js/unificado/shared-exercise-engine.js';

const sourceCommit='3790500f772aad3f8c263b68e8e2dfd8bab7c465';
export function verifySharedExerciseParity({index,modules,bundles,questionsByModule,originalAchievement,seeds=3}){
 assert.equal(index.moduleCount,27);assert.equal(index.questionCount,757);assert.equal(modules.length,27);
 let checked=0,totalQuestions=0,duplicateChecks=0;const failures=[];
 for(const mod of modules){
   const bundle=bundles.get(mod.id),qs=questionsByModule.get(mod.id);
   if(!bundle||!Array.isArray(qs)||!qs.length||bundle.moduleId!==mod.id||bundle.questionCount!==qs.length)
     throw Error('Pacotes e questões divergentes em '+mod.id);
   totalQuestions+=qs.length;
   for(let seed=1;seed<=seeds;seed++){
     const before=buildParityFixture(modules,index,seed*811+73);
     const original=originalAchievement(before,mod);
     for(const answeredCount of [1,Math.min(6,qs.length),null]){
       const native=createTrainingState('2026-11-24T18:00:00.000Z');
       const session=startLearningExercise(native,qs,mod.id,{now:'2026-11-24T18:00:00.000Z',random:()=>0.3});
       const count=answeredCount??session.ids.length;
       for(let i=0;i<count;i++){
         const q=qs.find(q=>q.id===session.ids[i]);
         const answer=(i+seed)%3===0?(q.answer+1)%q.options.length:q.answer;
         answerLearningExercise(native,q,answer,{now:'2026-11-24T18:00:00.000Z'});
         const correct=answer===q.answer;
         assessLearningExercise(native,q,correct?'seguro':'pegadinha',{now:'2026-11-24T18:00:00.000Z'});
         if(i<count-1)nextLearningExercise(native,mod.id,{now:'2026-11-24T18:00:00.000Z'});
       }
       const summary=exerciseSessionSummary(native,mod.id,qs);
       assert.equal(summary.answered,count);
       const after=structuredClone(before);
       after.progress.exercises[mod.id]={ids:[...session.ids],answers:{...session.answers},
         startedAt:session.startedAt,finishedAt:session.finishedAt};
       const expected=originalAchievement(after,mod);
       const actual=calculateSharedModuleProgress(bundle,before.progress,original,
         createSharedActivityState('administracao'),{training:native,questions:qs});
       for(const field of ['earnedWeightedPoints','percentage','availableWeight','hasData'])
         if(actual[field]!==expected[field])failures.push({moduleId:mod.id,seed,count,field,expected:expected[field],actual:actual[field]});
       const a=actual.components.exercises,b=expected.components.exercises;
       for(const field of ['points','score','coverage','available'])
         if(a[field]!==b[field])failures.push({moduleId:mod.id,seed,count,component:'exercises',field,expected:b[field],actual:a[field]});
       checked++;
       const q=qs.find(q=>q.id===session.ids[0]);
       recordTrainingAttempt(native,q,q.answer,{source:'bank',now:'2026-11-24T18:00:00.000Z'});
       const totals=summarizeTraining(native);
       if(totals.distinct!==count||totals.bySource.exercise!==count||totals.bySource.bank!==1)
         failures.push({moduleId:mod.id,seed,count,issue:'Questão duplicada entre Banco e Exercícios'});
       duplicateChecks++;
     }
   }
 }
 assert.equal(totalQuestions,757);
 if(failures.length)throw Error(`Fase 8C: ${failures.length} divergências: ${JSON.stringify(failures.slice(0,8))}`);
 return {moduleCount:27,questionCount:757,comparedModuleScores:checked,duplicateChecks,
   discrepancies:0,sourceCommit};
}
async function main(){
 const root=resolve(process.argv[2]??'');
 if(!process.argv[2]||!/(?:^|[\\/])dist[\\/]administracao$/.test(root))
   throw Error('Executar somente em dist/administracao.');
 const index=JSON.parse(readFileSync(join(root,'catalogo-leve/pedagogia-index.json'),'utf8'));
 const bundleManifest=JSON.parse(readFileSync(join(root,'catalogo-leve/motor-unificado/manifest.json'),'utf8'));
 const questionManifest=JSON.parse(readFileSync(join(root,'catalogo-leve/manifest.json'),'utf8'));
 if(questionManifest.questionCount!==757||bundleManifest.questionCount!==757)throw Error('Catálogos diferentes.');
 const {MODULES}=await import(pathToFileURL(join(root,'js/data/modules.js')).href);
 const bundles=new Map(),questionsByModule=new Map();
 for(const entry of bundleManifest.modules){
   const b=(await import(pathToFileURL(join(root,'catalogo-leve/motor-unificado',entry.file)).href)).default;
   bundles.set(entry.id,b);
   const q=questionManifest.modules.find(x=>x.id===entry.id);
   if(!q)throw Error('Sem questões do módulo '+entry.id);
   const items=(await import(pathToFileURL(join(root,'catalogo-leve',q.file)).href)).QUESTIONS;
   questionsByModule.set(entry.id,items);
 }
 const {moduleAchievement}=await import(pathToFileURL(join(root,'js/features/module-achievement.js')).href);
 for(const name of ['questions-f25-lote04.js','questions-f25-lote06.js','questions-f25-lote08.js','questions-f25-lote09.js','questions-f23-lote02.js'])
   await import(pathToFileURL(join(root,'js/data',name)).href);
 const report=verifySharedExerciseParity({index,modules:MODULES,bundles,questionsByModule,originalAchievement:moduleAchievement});
 const output={format:'estudo-concursos/phase8c-ci-integration/v1',...report,
  method:'Pontuação de Exercícios comparada diretamente à função original do ADM-ESTUDO, usando questões integrais por módulo.',
  limitation:'Cenários sintéticos; a pontuação herdada do Banco permanece congelada quando não há histórico individual reconciliado.'};
 writeFileSync(join(root,'catalogo-leve/auditoria-fase8c.json'),JSON.stringify(output,null,2)+'\n','utf8');
 console.log(`Fase 8C: ${report.comparedModuleScores} comparações de exercícios e ${report.duplicateChecks} verificações de ID sem divergências.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(e=>{console.error('[Fase 8C] Auditoria bloqueou a publicação:',e.stack||e.message);process.exitCode=1});
