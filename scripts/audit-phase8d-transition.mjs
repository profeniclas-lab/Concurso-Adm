/** Fase 8D — conciliação por ID confrontada com o motor ORIGINAL.
 * Testa Banco antigo + novo em 27 módulos, usando catálogo de 757 questões.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {strict as assert} from 'node:assert';
import {buildParityFixture} from './audit-phase7e-parity.mjs';
import {createTrainingState,recordTrainingAttempt} from '../site/js/unificado/training-engine.js';
import {calculateSharedModuleProgress} from '../site/js/unificado/shared-progress.js';
import {createSharedActivityState} from '../site/js/unificado/shared-activity-store.js';

const oldTime='2026-11-20T12:00:00.000Z',newTime='2026-11-23T12:00:00.000Z';
export function verifyPhase8D({index,modules,bundles,questions,achievement,seeds=6}){
 assert.equal(index.questionCount,757);assert.equal(index.moduleCount,27);
 assert.equal(modules.length,27);
 let checked=0,overlapChecks=0,questionCount=0;
 const errors=[];
 for(const module of modules){
  const qs=questions.get(module.id),bundle=bundles.get(module.id);
  if(!bundle||!qs||qs.length!==bundle.questionCount||bundle.moduleId!==module.id)
   throw Error('O pacote não corresponde à fonte: '+module.id);
  questionCount+=qs.length;
  for(let seed=1;seed<=seeds;seed++){
   const legacy=buildParityFixture(modules,index,seed*1051+29);
   for(const r of Object.values(legacy.progress.questionHistory)){
    if(r.bankAttempt)r.bankAttempt.updatedAt=oldTime;
    if(['acerto_banco','erro_banco'].includes(r.assessment))r.updatedAt=oldTime;
   }
   const original=achievement(legacy,module);
   const beforeBankIds=qs.filter(q=>legacy.progress.questionHistory[q.id]?.bankAttempt||
     ['acerto_banco','erro_banco'].includes(legacy.progress.questionHistory[q.id]?.assessment));
   // Cenário 1: mesmo ID já presente no Banco antigo. 2: ID novo no Banco.
   for(const kind of ['overlap','new']){
    const q=kind==='overlap'?beforeBankIds[0]:qs.find(q=>!beforeBankIds.includes(q));
    if(!q)continue;
    const answer=(q.answer+1)%q.options.length;
    const training=createTrainingState(newTime);
    recordTrainingAttempt(training,q,answer,{source:'bank',now:newTime});
    const newer=structuredClone(legacy);
    newer.progress.questionHistory[q.id]={
      ...newer.progress.questionHistory[q.id],bankAttempt:{lastAnswer:answer,updatedAt:newTime}};
    const expected=achievement(newer,module);
    const actual=calculateSharedModuleProgress(bundle,legacy.progress,original,
      createSharedActivityState('administracao'),{training,questions:qs,baselineSource:'legacy'});
    if(actual.bankReconciliation?.status!==(original.components.bank.available?'merged':'native-only'))
      errors.push({module:module.id,seed,kind,status:actual.bankReconciliation?.status});
    for(const field of ['earnedWeightedPoints','percentage','availableWeight','hasData'])
      if(actual[field]!==expected[field])errors.push({module:module.id,seed,kind,field,actual:actual[field],expected:expected[field]});
    for(const field of ['score','points','coverage','available'])
      if(actual.components.bank[field]!==expected.components.bank[field])
        errors.push({module:module.id,seed,kind,field,actual:actual.components.bank[field],expected:expected.components.bank[field]});
    checked++;
    if(kind==='overlap')overlapChecks++;
   }
  }
 }
 assert.equal(questionCount,757);
 if(errors.length)throw Error(`Fase 8D: ${errors.length} divergências: ${JSON.stringify(errors.slice(0,10))}`);
 return {moduleCount:27,questionCount:757,comparedBankScores:checked,
   overlapChecks,discrepancies:0};
}
async function main(){
 const root=resolve(process.argv[2]??'');
 if(!process.argv[2]||!/(?:^|[\\/])dist[\\/]administracao$/.test(root))
   throw Error('Executar somente em dist/administracao.');
 const index=JSON.parse(readFileSync(join(root,'catalogo-leve/pedagogia-index.json'),'utf8'));
 const bm=JSON.parse(readFileSync(join(root,'catalogo-leve/motor-unificado/manifest.json'),'utf8'));
 const qm=JSON.parse(readFileSync(join(root,'catalogo-leve/manifest.json'),'utf8'));
 if(bm.questionCount!==757||qm.questionCount!==757||index.catalogSha256!==qm.completeBankSha256)
   throw Error('Catálogos de origem incompatíveis.');
 const {MODULES}=await import(pathToFileURL(join(root,'js/data/modules.js')).href);
 const bundles=new Map(),questions=new Map();
 for(const b of bm.modules){
  bundles.set(b.id,(await import(pathToFileURL(join(root,'catalogo-leve/motor-unificado',b.file)).href)).default);
  const q=qm.modules.find(m=>m.id===b.id);if(!q)throw Error('Questões ausentes: '+b.id);
  questions.set(b.id,(await import(pathToFileURL(join(root,'catalogo-leve',q.file)).href)).QUESTIONS);
 }
 const {moduleAchievement}=await import(pathToFileURL(join(root,'js/features/module-achievement.js')).href);
 for(const n of ['questions-f25-lote04.js','questions-f25-lote06.js','questions-f25-lote08.js','questions-f25-lote09.js','questions-f23-lote02.js'])
  await import(pathToFileURL(join(root,'js/data',n)).href);
 const report=verifyPhase8D({index,modules:MODULES,bundles,questions,achievement:moduleAchievement});
 const output={format:'estudo-concursos/phase8d-ci-parity/v1',...report,
  sourceCommit:'3790500f772aad3f8c263b68e8e2dfd8bab7c465',
  catalogSha256:index.catalogSha256,
  limitation:'Cenários sintéticos com datas válidas. Cópias F7C sem detalhes de Banco permanecem congeladas; o histórico real exige verificação manual.',
  method:'Compara o Banco por ID do motor novo com a função moduleAchievement() original, simulando uma resposta mais recente, com e sem sobreposição de ID.'};
 writeFileSync(join(root,'catalogo-leve/auditoria-fase8d.json'),JSON.stringify(output,null,2)+'\n');
 console.log(`Fase 8D: ${report.comparedBankScores} comparações com o motor original, ${report.overlapChecks} sobreposições de IDs, zero divergências.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(e=>{console.error('[Fase 8D] Publicação bloqueada:',e.stack||e.message);process.exitCode=1});
