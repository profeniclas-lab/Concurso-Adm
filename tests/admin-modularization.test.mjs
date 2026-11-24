import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { planQuestionSplit, gitBlobSha, EXPECTED_QUESTION_BLOB_SHA } from '../scripts/modularize-admin-questions.mjs';

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
