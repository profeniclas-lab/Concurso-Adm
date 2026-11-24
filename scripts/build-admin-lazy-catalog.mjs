/**
 * Fase 5: gera uma visão SOMENTE DE LEITURA do banco completo por módulo.
 * As questões do motor ADM-ESTUDO e o progresso existente nunca são modificados.
 * Executar APÓS a Fase 4 e APENAS sobre o snapshot dist/administracao.
 */
import { createHash } from 'node:crypto';
import { deepStrictEqual } from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const EXPECTED_TOTAL = 757;
const isModuleId = id => /^(?:ADM|AP|DA)-\d{2}$/.test(id);
const sha256 = x => createHash('sha256').update(x).digest('hex');

export function planLazyCatalog(modules, questions, baselineManifest, { expectedTotal = EXPECTED_TOTAL } = {}) {
  if (!Array.isArray(modules) || !Array.isArray(questions) || typeof baselineManifest !== 'object' || baselineManifest === null)
    throw new Error('Catálogo ou banco inválido; geração bloqueada.');
  if (questions.length !== expectedTotal || baselineManifest.questionCount !== expectedTotal)
    throw new Error(`Quantidade incorreta: recebido ${questions.length}, manifesto ${baselineManifest.questionCount}; esperado ${expectedTotal}.`);
  if (baselineManifest.fullDataSha256 !== sha256(JSON.stringify(questions)))
    throw new Error('O banco completo divergiu do SHA-256 já validado na Fase 4.');
  const ids = new Set();
  const byModule = new Map();
  for (const q of questions) {
    if (!q || !isModuleId(q.moduleId) || typeof q.id !== 'string' || !q.id || ids.has(q.id))
      throw new Error(`Questão sem ID, módulo reconhecido ou ID duplicado: ${q?.id}`);
    ids.add(q.id);
    if (!byModule.has(q.moduleId)) byModule.set(q.moduleId, []);
    byModule.get(q.moduleId).push(q);
  }
  const moduleIds = new Set();
  const files = new Map();
  const entries = [];
  for (const module of modules) {
    if (!isModuleId(module?.id) || moduleIds.has(module.id) || typeof module.title !== 'string')
      throw new Error(`Módulo inválido ou duplicado: ${module?.id}`);
    moduleIds.add(module.id);
    const items = byModule.get(module.id) ?? [];
    if (!items.length) throw new Error(`Módulo sem questões: ${module.id}`);
    const baseline = baselineManifest.modules?.find(x => x.id === module.id);
    if (!baseline || baseline.totalCount !== items.length)
      throw new Error(`Contagem incompatível para ${module.id}: ${items.length}.`);
    const source = JSON.stringify(items);
    const file = `questoes/${module.id}.js`;
    files.set(file, `/** Fase 5: visão imutável para consulta, gerada de dados aprovados. */\nexport const QUESTIONS = ${JSON.stringify(items, null, 2)};\n`);
    entries.push({ id: module.id, title: module.title, area: module.area,
      count: items.length, file, dataSha256: sha256(source) });
  }
  if (byModule.size !== entries.length || entries.reduce((n,x)=>n+x.count,0) !== questions.length)
    throw new Error('Algumas questões não foram atribuídas a um módulo.');
  return {
    files,
    manifest: {
      format:'estudo-concursos/admin-lazy-catalog/v1',
      generatedFrom:'profeniclas-lab/Dir-Adm — snapshot validado nas Fases 3 e 4',
      questionCount: questions.length,
      moduleCount: entries.length,
      completeBankSha256: baselineManifest.fullDataSha256,
      modules:entries
    }
  };
}

export async function writeLazyCatalog(adminRoot, plan) {
  const root=resolve(adminRoot);
  const dir=join(root, 'catalogo-leve');
  mkdirSync(join(dir,'questoes'),{recursive:true});
  for(const [name, content] of plan.files)writeFileSync(join(dir,name),content,'utf8');
  writeFileSync(join(dir,'manifest.json'), JSON.stringify(plan.manifest,null,2)+'\n','utf8');
  // Validação pós-geração: cada import corresponde exatamente aos objetos originais.
  for(const entry of plan.manifest.modules){
    const loaded=await import(pathToFileURL(join(dir,entry.file)).href);
    if(sha256(JSON.stringify(loaded.QUESTIONS)) !== entry.dataSha256)
      throw new Error(`Arquivo gerado divergente: ${entry.file}`);
  }
  return dir;
}

async function main() {
  const root = resolve(process.argv[2] ?? '');
  if (!process.argv[2] || !/(?:^|[\\/])dist[\\/]administracao$/.test(root))
    throw new Error('Por segurança, use apenas o diretório dist/administracao.');
  const manifest = JSON.parse(readFileSync(join(root,'js/data/questions-modules/manifest.json'),'utf8'));
  const modules = (await import(pathToFileURL(join(root,'js/data/modules.js')).href)).MODULES;
  // Reproduz a inicialização normal: F25 antes da revisão F23.
  const source = await import(pathToFileURL(join(root,'js/data/questions.js')).href);
  for(const name of ['questions-f25-lote04.js','questions-f25-lote06.js','questions-f25-lote08.js','questions-f25-lote09.js'])
    await import(pathToFileURL(join(root,'js/data',name)).href);
  await import(pathToFileURL(join(root,'js/data/questions-f23-lote02.js')).href);
  const plan = planLazyCatalog(modules, source.QUESTIONS, manifest);
  await writeLazyCatalog(root, plan);
  // Compara cada objeto pela ordem dentro do módulo, sem alterar nem acrescentar propriedades.
  for(const entry of plan.manifest.modules) {
    const actual=(await import(pathToFileURL(join(root,'catalogo-leve',entry.file)).href)).QUESTIONS;
    deepStrictEqual(actual, source.QUESTIONS.filter(q=>q.moduleId===entry.id));
  }
  console.log(`Fase 5: ${plan.manifest.questionCount} questões preservadas em ${plan.manifest.moduleCount} módulos de consulta sob demanda.`);
  console.log('O motor administrativo e os dados de progresso não foram modificados.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main().catch(e=>{console.error('[Fase 5] Publicação bloqueada:',e.message);process.exitCode=1});
