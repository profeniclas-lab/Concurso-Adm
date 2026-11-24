/**
 * Fase 7E — comparação independente com O MOTOR ORIGINAL, não com fórmula copiada.
 * Executada depois de gerar dist/administracao a partir do commit fixado.
 * Não abre localStorage, não usa dados do usuário e não altera questões.
 * Falha o build se encontrar diferenças de aproveitamento ou do catálogo.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {strict as assert} from 'node:assert';
import {createHash} from 'node:crypto';
import {modulePedagogy,validatePedagogyIndex} from '../site/js/unificado/admin-pedagogy.js';

const sha256=value=>createHash('sha256').update(value).digest('hex');

/** Gerador determinístico: todos os cenários podem ser repetidos no CI. */
export function randomSource(seed=7){
  let value=seed>>>0;
  return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
}

/** Estado artificial, nunca obtido do localStorage do usuário. */
export function buildParityFixture(modules,index,seed){
  const r=randomSource(seed);
  const progress={modules:{},diagnostics:{},lessons:{},exercises:{},questionHistory:{},flashcards:{},errors:[],reviewQueue:[]};
  const ratings=['sei','duvida','nao'];
  for(const module of modules){
    const ref=index.modules.find(m=>m.id===module.id);
    if(!ref)throw Error('Módulo ausente no índice: '+module.id);
    if(r()<.7){
      const answers={};for(const id of ref.diagnosticIds)if(r()<.68)answers[id]=ratings[Math.floor(r()*3)];
      if(Object.keys(answers).length)progress.diagnostics[module.id]={answers};
    }
    for(const id of ref.lessonIds){
      if(r()<.66){const entry={};if(r()<.65)entry.completed=true;if(r()<.8)entry.rating=ratings[Math.floor(r()*3)];
        if(Object.keys(entry).length)progress.lessons[id]=entry;}
    }
    // Exercícios em andamento, completos, parcialmente respondidos e vazios.
    if(r()<.8){
      const pool=ref.bank;
      const size=Math.min(pool.length,Math.max(1,Math.floor(r()*8)+1));
      const ids=pool.slice(0,size).map(q=>q.id);
      const answers={};for(const q of pool.slice(0,size))if(r()<.62){
        const correct=r()<.55;answers[q.id]=correct?q.answer:(q.answer+1)%q.optionCount;
      }
      progress.exercises[module.id]={ids,answers,assessments:{},cursor:0,startedAt:'2026-11-20T12:00:00.000Z',finishedAt:null};
    }
    // O banco só pontua quando o registro explicita origem de banco.
    for(const q of ref.bank){
      if(r()>.34)continue;
      const answer=r()<.62?q.answer:(q.answer+1)%q.optionCount;
      if(r()<.75)progress.questionHistory[q.id]={bankAttempt:{lastAnswer:answer}};
      else progress.questionHistory[q.id]={assessment:answer===q.answer?'acerto_banco':'erro_banco',lastAnswer:answer};
    }
  }
  return {schemaVersion:3,appVersion:'2.0.0',navigation:{currentRoute:'dashboard'},
    preferences:{theme:'light'},metadata:{createdAt:'2026-11-20T12:00:00.000Z',updatedAt:'2026-11-24T12:00:00.000Z'},progress};
}

/** Injeta a função ORIGINAL, permitindo testar o detector sem baixar o repositório. */
export function verifyParity({index,modules,originalAchievement,scenarios=12}){
  validatePedagogyIndex(index);
  assert.equal(modules.length,index.moduleCount,'Quantidade de módulos da fonte alterada.');
  if(scenarios<1||!Number.isInteger(scenarios))throw Error('Quantidade inválida de cenários.');
  let compared=0;
  const mismatches=[];
  for(let seed=1;seed<=scenarios;seed++){
    const state=buildParityFixture(modules,index,seed*104729);
    for(const mod of modules){
      const original=originalAchievement(state,mod);
      const current=modulePedagogy(state,index.modules.find(m=>m.id===mod.id));
      const fields=['earnedWeightedPoints','availableWeight','coveragePercentage','percentage','hasData'];
      for(const field of fields)if(original[field]!==current[field]){
        mismatches.push({seed,moduleId:mod.id,field,original:original[field],portal:current[field]});
      }
      for(const key of ['diagnostic','lessonCompletion','lessonSelfAssessment','exercises','bank']){
        const a=original.components[key],b=current.components[key];
        for(const field of ['weight','points','coverage','score','available'])
          if(a[field]!==b[field])mismatches.push({seed,moduleId:mod.id,component:key,field,original:a[field],portal:b[field]});
      }
      compared++;
    }
  }
  if(mismatches.length)throw Error(`Fase 7E: ${mismatches.length} divergências entre motor original e portal: ${JSON.stringify(mismatches.slice(0,10))}`);
  return {scenarios,modules:modules.length,compared,mismatches:0};
}

async function main(){
  const dir=resolve(process.argv[2]??'');
  if(!process.argv[2]||!/(?:^|[\\/])dist[\\/]administracao$/.test(dir))
    throw Error('Por segurança, executar somente sobre dist/administracao.');
  const data=join(dir,'js/data');
  const index=validatePedagogyIndex(JSON.parse(readFileSync(join(dir,'catalogo-leve/pedagogia-index.json'),'utf8')));
  const manifest=JSON.parse(readFileSync(join(dir,'catalogo-leve/manifest.json'),'utf8'));
  assert.equal(manifest.questionCount,757);assert.equal(manifest.moduleCount,27);
  assert.equal(index.catalogSha256,manifest.completeBankSha256,'Hash de fonte difere entre índices.');
  const {MODULES}=await import(pathToFileURL(join(data,'modules.js')).href);
  const dataModule=await import(pathToFileURL(join(data,'questions.js')).href);
  for(const name of ['questions-f25-lote04.js','questions-f25-lote06.js','questions-f25-lote08.js','questions-f25-lote09.js'])
    await import(pathToFileURL(join(data,name)).href);
  await import(pathToFileURL(join(data,'questions-f23-lote02.js')).href);
  assert.equal(dataModule.QUESTIONS.length,757,'Questões faltando após os lotes F25.');
  assert.equal(sha256(JSON.stringify(dataModule.QUESTIONS)),index.catalogSha256,'Banco final não corresponde ao índice pedagógico.');
  const {moduleAchievement}=await import(pathToFileURL(join(dir,'js/features/module-achievement.js')).href);
  const verified=verifyParity({index,modules:MODULES,originalAchievement:moduleAchievement,scenarios:24});
  const report={format:'estudo-concursos/phase7e-ci-parity/v1',
    sourceCommit:'3790500f772aad3f8c263b68e8e2dfd8bab7c465',
    questionCount:757,moduleCount:27,catalogSha256:index.catalogSha256,
    scenarios:verified.scenarios,comparedModuleScores:verified.compared,discrepancies:0,
    explanation:'Estados artificiais, comparados diretamente à função original moduleAchievement(). Não são dados do usuário.',
    limitation:'Importações reais com sessões ativas ou alterações após a importação exigem comparação manual.'};
  writeFileSync(join(dir,'catalogo-leve/auditoria-fase7e.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`Fase 7E: paridade confirmada com motor original em ${verified.compared} avaliações de módulo; 757 questões preservadas.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error('[Fase 7E] Auditoria bloqueou a publicação:',e.stack||e.message);process.exitCode=1;});
