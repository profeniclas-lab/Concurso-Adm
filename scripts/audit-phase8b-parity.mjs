/**
 * Fase 8B — compara o aproveitamento com registros nativos ao MOTOR ORIGINAL
 * do ADM-ESTUDO. Não usa localStorage nem conteúdos ou histórico pessoais.
 * Usado no build APÓS geração dos pacotes de módulo e verificação F7E.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {strict as assert} from 'node:assert';
import {buildParityFixture} from './audit-phase7e-parity.mjs';
import {createSharedActivityState,applySharedActivity} from '../site/js/unificado/shared-activity-store.js';
import {calculateSharedModuleProgress} from '../site/js/unificado/shared-progress.js';

const sourceCommit='3790500f772aad3f8c263b68e8e2dfd8bab7c465';
function applyOverlayToLegacy(state,module,bundle,overlay){
 const p=state.progress;
 for(const [modId,rec] of Object.entries(overlay.diagnostics)){
   if(modId!==module.id)continue;
   p.diagnostics[modId]??={answers:{}};
   for(const [id,rating] of Object.entries(rec.answers))p.diagnostics[modId].answers[id]=rating;
 }
 for(const [id,rec] of Object.entries(overlay.lessons)){
   if(!id.startsWith(module.id+'-'))continue;
   p.lessons[id]??={};
   if(rec.completed===true)p.lessons[id].completed=true;
   if(rec.rating!==undefined)p.lessons[id].rating=rec.rating;
 }
 return state;
}

export function verifySharedParity({index,modules,bundles,originalAchievement,scenarios=16}){
 assert.equal(modules.length,27);assert.equal(index.questionCount,757);
 if(!Number.isSafeInteger(scenarios)||scenarios<1)throw Error('Quantidade inválida de cenários.');
 const mismatches=[];let compared=0;
 const check=(expect,received,seed,mod,stage)=>{
   for(const field of ['earnedWeightedPoints','availableWeight','percentage','hasData']){
     if(expect[field]!==received[field])mismatches.push({seed,moduleId:mod.id,stage,field,expected:expect[field],newValue:received[field]});
   }
   if((expect.earnedWeightedPoints>=75)!==(received.completed??(received.earnedWeightedPoints>=75)))
     mismatches.push({seed,moduleId:mod.id,stage,field:'meta75',expected:expect.earnedWeightedPoints>=75,actual:received.completed});
   for(const kind of ['diagnostic','lessonCompletion','lessonSelfAssessment','exercises','bank']){
     const a=expect.components[kind],b=received.components[kind];
     for(const field of ['points','coverage','score','available'])
       if(a[field]!==b[field])mismatches.push({seed,moduleId:mod.id,stage,component:kind,field,expected:a[field],actual:b[field]});
   }
   compared++;
 };
 for(let seed=1;seed<=scenarios;seed++){
   const prior=buildParityFixture(modules,index,seed*7919);
   for(const mod of modules){
     const bundle=bundles.get(mod.id),first=bundle?.subtopics[0]?.id,second=bundle?.subtopics[1]?.id;
     if(!bundle||bundle.subjectId!=='administracao'||bundle.moduleId!==mod.id||!first||bundle.diagnostic.length!==mod.subtopics.length)
       throw Error('Pacote nativo incompatível: '+mod.id);
     const baseline=originalAchievement(prior,mod);
     const empty=createSharedActivityState('administracao');
     const unchanged=calculateSharedModuleProgress(bundle,prior.progress,baseline,empty);
     check(baseline,unchanged,seed,mod,'sem-atividade-nova');
     const overlay=createSharedActivityState('administracao');
     applySharedActivity(overlay,bundle,{kind:'diagnostic',topicId:first,rating:'sei'});
     applySharedActivity(overlay,bundle,{kind:'lesson-rating',topicId:first,rating:'nao'});
     applySharedActivity(overlay,bundle,{kind:'lesson-complete',topicId:second??first});
     const expected=originalAchievement(applyOverlayToLegacy(structuredClone(prior),mod,bundle,overlay),mod);
     const combined=calculateSharedModuleProgress(bundle,prior.progress,baseline,overlay);
     check(expected,combined,seed,mod,'com-atividade-nova');
   }
 }
 if(mismatches.length)throw Error(`Fase 8B: ${mismatches.length} divergências com ADM-ESTUDO original: ${JSON.stringify(mismatches.slice(0,8))}`);
 return {scenarios,modules:modules.length,comparisons:compared,discrepancies:0};
}

async function main(){
 const root=resolve(process.argv[2]??'');
 if(!process.argv[2]||!/(?:^|[\\/])dist[\\/]administracao$/.test(root))throw Error('Executar somente em dist/administracao.');
 const index=JSON.parse(readFileSync(join(root,'catalogo-leve/pedagogia-index.json'),'utf8'));
 const manifest=JSON.parse(readFileSync(join(root,'catalogo-leve/motor-unificado/manifest.json'),'utf8'));
 assert.equal(manifest.moduleCount,27);assert.equal(manifest.questionCount,757);
 assert.equal(manifest.sourceCatalogSha256,index.catalogSha256);
 const {MODULES}=await import(pathToFileURL(join(root,'js/data/modules.js')).href);
 const bundles=new Map();
 for(const entry of manifest.modules){
   const file=join(root,'catalogo-leve/motor-unificado',entry.file);
   const bundle=(await import(pathToFileURL(file).href)).default;
   bundles.set(entry.id,bundle);
 }
 const {moduleAchievement}=await import(pathToFileURL(join(root,'js/features/module-achievement.js')).href);
 // O arquivo modular questions.js recebe todos os lotes e as revisões antes da avaliação.
 for(const name of ['questions-f25-lote04.js','questions-f25-lote06.js','questions-f25-lote08.js','questions-f25-lote09.js', 'questions-f23-lote02.js'])
   await import(pathToFileURL(join(root,'js/data',name)).href);
 const report=verifySharedParity({index,modules:MODULES,bundles,originalAchievement:moduleAchievement,scenarios:24});
 const output={format:'estudo-concursos/phase8b-ci-parity/v1',sourceCommit,
   questionCount:757,moduleCount:27,scenarios:report.scenarios,
   comparedModuleScores:report.comparisons,discrepancies:report.discrepancies,
   method:'Comparação direta com moduleAchievement() da origem, com e sem três registros nativos por módulo.',
   limitation:'Estados sintéticos, não o histórico pessoal. A fonte de treino e as revisões permanecem separadas até a Fase 8C.'};
 writeFileSync(join(root,'catalogo-leve/auditoria-fase8b.json'),JSON.stringify(output,null,2)+'\n','utf8');
 console.log(`Fase 8B: ${report.comparisons} comparações de aproveitamento com o motor original, zero divergências.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(e=>{console.error('[Fase 8B] Auditoria bloqueou a publicação:',e.stack||e.message);process.exitCode=1});
