/** Fase 7C: índice pedagógico DERIVADO apenas na montagem dist/administracao.
 * Não altera os conteúdos nem os estados. Inclui apenas IDs, disponibilidade
 * de aulas/diagnósticos e índices do gabarito técnico por módulo.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

export const PEDAGOGY_INDEX_FORMAT='estudo-concursos/admin-pedagogy-index/v1';
const checksum=x=>createHash('sha256').update(x).digest('hex');
const pattern=/^(?:ADM|AP|DA)-\d{2}$/;
export function buildPedagogyIndex(modules,lessons,diagnostics,questions,manifest){
  if(!Array.isArray(modules)||!lessons||!diagnostics||!Array.isArray(questions)||
     manifest?.questionCount!==757||manifest.moduleCount!==27||modules.length!==27||questions.length!==757)
    throw Error('Índice pedagógico: catálogo incompleto; publicação bloqueada.');
  if(typeof manifest.completeBankSha256!=='string'||checksum(JSON.stringify(questions))!==manifest.completeBankSha256)
    throw Error('Gabaritos da fonte divergentes do catálogo validado da Fase 5.');
  const ids=new Set(), questionByModule=new Map();
  for(const q of questions){
    if(!q||!pattern.test(q.moduleId)||typeof q.id!=='string'||!q.id||ids.has(q.id)||
       !Array.isArray(q.options)||q.options.length<2||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length)
      throw Error(`Questão inválida ou repetida: ${q?.id}`);
    ids.add(q.id);
    if(!questionByModule.has(q.moduleId))questionByModule.set(q.moduleId,[]);
    questionByModule.get(q.moduleId).push({id:q.id,answer:q.answer,optionCount:q.options.length});
  }
  const seen=new Set(), output=[];
  for(const mod of modules){
    if(!pattern.test(mod?.id)||seen.has(mod.id)||!Array.isArray(mod.subtopics))throw Error('Módulo duplicado ou sem subtópicos.');
    seen.add(mod.id);
    const subtopics=mod.subtopics.map(x=>x.id);
    if(subtopics.length!==new Set(subtopics).size||!subtopics.every(id=>id.startsWith(mod.id+'-')))
      throw Error(`Subtópicos inválidos em ${mod.id}`);
    const cards=diagnostics[mod.id];
    const diagnosticIds=Array.isArray(cards)&&cards.length===subtopics.length&&
      cards.every(x=>x&&typeof x.subtopicId==='string')&&new Set(cards.map(x=>x.subtopicId)).size===subtopics.length&&
      subtopics.every(id=>cards.some(x=>x.subtopicId===id))?subtopics:[];
    const lessonIds=subtopics.filter(id=>Boolean(lessons[id]));
    const bank=questionByModule.get(mod.id)||[];
    if(bank.length!==manifest.modules.find(m=>m.id===mod.id)?.count)throw Error(`Banco divergente em ${mod.id}`);
    output.push({id:mod.id,title:mod.title,area:mod.area,subtopicIds:subtopics,diagnosticIds,lessonIds,bank});
  }
  if(seen.size!==27||questionByModule.size!==27||output.reduce((n,m)=>n+m.bank.length,0)!==757)
    throw Error('Índice pedagógico não preserva os 27 módulos e 757 questões.');
  return {format:PEDAGOGY_INDEX_FORMAT,questionCount:757,moduleCount:27,
    catalogSha256:manifest.completeBankSha256,
    modules:output,integritySha256:checksum(JSON.stringify(output))};
}

async function main(){
  const root=resolve(process.argv[2]??'');
  if(!process.argv[2]||!/(?:^|[\\/])dist[\\/]administracao$/.test(root))
    throw Error('Por segurança, use apenas dist/administracao.');
  const dir=join(root,'js/data');
  const manifest=JSON.parse(readFileSync(join(root,'catalogo-leve/manifest.json'),'utf8'));
  const mod=(await import(pathToFileURL(join(dir,'modules.js')).href)).MODULES;
  const lessons=(await import(pathToFileURL(join(dir,'lessons.js')).href)).LESSONS;
  const diagnostics=(await import(pathToFileURL(join(dir,'diagnostics.js')).href)).DIAGNOSTICS;
  // Aplicação das mesmas fontes finais do catálogo leve.
  const source=await import(pathToFileURL(join(dir,'questions.js')).href);
  for(const name of ['questions-f25-lote04.js','questions-f25-lote06.js','questions-f25-lote08.js','questions-f25-lote09.js'])
    await import(pathToFileURL(join(dir,name)).href);
  await import(pathToFileURL(join(dir,'questions-f23-lote02.js')).href);
  const index=buildPedagogyIndex(mod,lessons,diagnostics,source.QUESTIONS,manifest);
  writeFileSync(join(root,'catalogo-leve/pedagogia-index.json'),JSON.stringify(index,null,2)+'\n','utf8');
  console.log('Fase 7C: índice pedagógico validado (27 módulos, 757 gabaritos técnicos, sem alterar a fonte).');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(error=>{console.error('[Fase 7C]',error.message);process.exitCode=1;});
