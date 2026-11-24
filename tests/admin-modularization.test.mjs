import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planQuestionSplit, gitBlobSha, EXPECTED_QUESTION_BLOB_SHA, summarizeCompleteBank, OVERLAY_BATCHES, EXPECTED_TOTAL_QUESTIONS } from '../scripts/modularize-admin-questions.mjs';

const sample = [
  {id:'Q-ADM-01-01',moduleId:'ADM-01',stem:'Pergunta com acentuação: eficiência',options:['Certo','Errado'],answer:1,explanation:'Texto preservado'},
  {id:'Q-ADM-01-02',moduleId:'ADM-01',stem:'Outro enunciado',options:['a','b','c'],answer:2,extra:{a:[1,2]}},
  {id:'Q-DA-17-01',moduleId:'DA-17',stem:'Teste',options:['Sim','Não'],answer:0}
];
const example = questions => `/* Arquivo de origem para testes técnicos. */\nexport const QUESTIONS = ${JSON.stringify(questions, null, 2)};\nexport const questionsForModule = id => QUESTIONS.filter(q=>q.moduleId===id);\n`;

test('F4: separa questões por módulo e preserva integralmente dados, gabaritos e ordem', async () => {
  const result = planQuestionSplit(example(sample));
  assert.equal(result.manifest.questionCount, 3);
  assert.equal(result.manifest.moduleCount, 2);
  assert.deepEqual(result.manifest.modules.map(x=>x.count), [2,1]);
  assert.deepEqual([...result.files.keys()], ['questions-modules/ADM-01.js','questions-modules/DA-17.js']);
  assert.equal(result.manifest.dataSha256.length, 64);
  const dir = mkdtempSync(join(tmpdir(),'estudo-f4-'));
  try {
    mkdirSync(join(dir,'questions-modules'));
    writeFileSync(join(dir,'package.json'),'{"type":"module"}');
    writeFileSync(join(dir,'questions.js'),result.facade);
    for(const [path,content] of result.files)writeFileSync(join(dir,path),content);
    const library = await import(pathToFileURL(join(dir,'questions.js')).href);
    assert.deepEqual(library.QUESTIONS,sample);
    assert.deepEqual(library.questionsForModule('ADM-01'),sample.slice(0,2));
    assert.deepEqual(library.questionsForModule('DA-17'),sample.slice(2));
  }finally{rmSync(dir,{recursive:true,force:true});}
});

test('F4: não aceita conteúdo incompatível, duplicado ou reorganização de ordem', () => {
  assert.throws(()=>planQuestionSplit(example([...sample,sample[0]])),/duplicado/);
  assert.throws(()=>planQuestionSplit(example([sample[0],sample[2],sample[1]])),/A fonte intercala/);
  assert.throws(()=>planQuestionSplit(example([{...sample[0],moduleId:'../../outside'}])),/módulo técnico/);
  assert.throws(()=>planQuestionSplit(example([])),/vazio/);
  assert.throws(()=>planQuestionSplit('export let QUESTOES=[]'),/QUESTIONS/);
  assert.throws(()=>planQuestionSplit(example(sample),{expectedBlobSha:'0000000000000000000000000000000000000000'}),/diferente da aprovada/);
  assert.equal(gitBlobSha(example(sample)).length,40);
  assert.match(EXPECTED_QUESTION_BLOB_SHA,/^[a-f0-9]{40}$/);
});

test('F4: mantém o carregamento compatível com módulos adicionais que acrescentam questões', async () => {
  const result=planQuestionSplit(example(sample));
  const dir=mkdtempSync(join(tmpdir(),'estudo-f4-overlay-'));
  try {
    mkdirSync(join(dir,'questions-modules'));
    writeFileSync(join(dir,'package.json'),'{"type":"module"}');
    writeFileSync(join(dir,'questions.js'),result.facade);
    for(const [path,content] of result.files)writeFileSync(join(dir,path),content);
    writeFileSync(join(dir,'lote.js'),`import {QUESTIONS} from './questions.js';\nQUESTIONS.push({id:'Q-DA-17-EXTRA',moduleId:'DA-17',stem:'Nova',options:['a','b'],answer:0});\n`);
    await import(pathToFileURL(join(dir,'lote.js')).href);
    const lib=await import(pathToFileURL(join(dir,'questions.js')).href);
    assert.equal(lib.QUESTIONS.length,sample.length+1);
    assert.equal(lib.questionsForModule('DA-17').length,2);
  }finally{rmSync(dir,{recursive:true,force:true});}
});


test('F4 correção: manifesta o banco completo, mantendo separada a base modularizada', () => {
  const plan = planQuestionSplit(example(sample));
  const additions = [{id:'Q-ADM-01-F25-01',moduleId:'ADM-01',stem:'Nova questão',options:['Sim','Não'],answer:0}];
  const full = [...sample,...additions];
  const manifest = summarizeCompleteBank(plan.manifest, full, [{file:'lote-teste.js',planned:1,added:1}],{expectedCount:4});
  assert.equal(manifest.questionCount,4);
  assert.equal(manifest.baseQuestionCount,3);
  assert.equal(manifest.additionalQuestionCount,1);
  assert.equal(manifest.totalQuestionCount,4);
  assert.equal(manifest.modules.find(x=>x.id==='ADM-01').baseCount,2);
  assert.equal(manifest.modules.find(x=>x.id==='ADM-01').totalCount,3);
  assert.equal(manifest.modules.find(x=>x.id==='ADM-01').count,2);
  assert.equal(manifest.modules.reduce((n,m)=>n+m.totalCount,0),4);
  assert.throws(()=>summarizeCompleteBank(plan.manifest, full, [],{expectedCount:4}),/lotes/);
  assert.throws(()=>summarizeCompleteBank(plan.manifest, full, [{added:1}],{expectedCount:5}),/incompleto/);
  assert.throws(()=>summarizeCompleteBank(plan.manifest,[...full,full[0]],[{added:2}]),/duplicado/);
  assert.equal(OVERLAY_BATCHES.reduce((n,x)=>n+x.expected,0),173);
  assert.equal(EXPECTED_TOTAL_QUESTIONS,584+173);
});


test('F4 correção: overlays usam a mesma instância ESM de QUESTIONS para contagem final', async () => {
  const plan=planQuestionSplit(example(sample));
  const dir=mkdtempSync(join(tmpdir(),'estudo-f4-final-'));
  try {
    mkdirSync(join(dir,'questions-modules'));
    writeFileSync(join(dir,'package.json'),'{"type":"module"}');
    writeFileSync(join(dir,'questions.js'),plan.facade);
    for(const [path,content] of plan.files)writeFileSync(join(dir,path),content);
    writeFileSync(join(dir,'batch.js'),`import {QUESTIONS} from './questions.js';\nQUESTIONS.push({id:'Q-ADM-01-EXTRA',moduleId:'ADM-01'});\nexport const BATCH_RESULT={planned:1,added:1};\n`);
    const base=await import(pathToFileURL(join(dir,'questions.js')).href);
    assert.equal(base.QUESTIONS.length,3);
    const batch=await import(pathToFileURL(join(dir,'batch.js')).href);
    assert.equal(batch.BATCH_RESULT.added,1);
    assert.equal(base.QUESTIONS.length,4,'O lote deve modificar a MESMA lista conferida no manifesto.');
    const result=summarizeCompleteBank(plan.manifest,base.QUESTIONS,[{file:'batch.js',added:1}],{expectedCount:4});
    assert.equal(result.totalQuestionCount,4);
  }finally{rmSync(dir,{recursive:true,force:true});}
});
