/**
 * ESTUDO-CONCURSOS — Fase 4
 * Divide SOMENTE a lista literal de questões da fonte administrativa já copiada
 * para dist/. Não modifica IDs, enunciados, alternativas, gabaritos nem o repo
 * Dir-Adm. O facade mantém a API síncrona do ADM-ESTUDO atual.
 *
 * Uso no CI: node scripts/modularize-admin-questions.mjs dist/administracao
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { deepStrictEqual, equal } from 'node:assert/strict';

// SHA Git do questions.js no commit administrativo fixado pela Fase 3.
export const EXPECTED_QUESTION_BLOB_SHA = 'b772363d33f069024bd06b1956e703124992cd87';
// Snapshot da branch administrativa usada nesta versão do portal (não é uma regra pedagógica).
export const EXPECTED_TOTAL_QUESTIONS = 757;
export const OVERLAY_BATCHES = Object.freeze([
  { file: 'questions-f25-lote04.js', resultName: 'F25_L04_RESULT', expected: 53 },
  { file: 'questions-f25-lote06.js', resultName: 'F25_L06_RESULT', expected: 51 },
  { file: 'questions-f25-lote08.js', resultName: 'F25_L08_RESULT', expected: 23 },
  { file: 'questions-f25-lote09.js', resultName: 'F25_L09_RESULT', expected: 46 }
]);
const DECLARATION = 'export const QUESTIONS = ';
const END_MARKER = '];';
const MODULE_ID_PATTERN = /^(?:ADM|AP|DA)-\d{2}$/;
const ID_PATTERN = /^Q-[A-Z0-9_-]+$/;

export function gitBlobSha(text) {
  const bytes = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
const sha256 = value => createHash('sha256').update(value).digest('hex');
const variableName = id => `Q_${id.replace(/[^A-Z0-9]/g, '_')}`;

export function planQuestionSplit(source, { expectedBlobSha = null } = {}) {
  if (typeof source !== 'string') throw Error('Fonte inválida: o arquivo de questões deve ser texto.');
  const sourceBlobSha = gitBlobSha(source);
  if (expectedBlobSha && expectedBlobSha !== sourceBlobSha) {
    throw Error(`Versão das questões administrativas diferente da aprovada. Esperado ${expectedBlobSha}; encontrado ${sourceBlobSha}. Nenhuma divisão aplicada.`);
  }
  const declarationAt = source.indexOf(DECLARATION);
  if (declarationAt < 0 || source.indexOf(DECLARATION, declarationAt + 1) !== -1)
    throw Error('Declaração única de QUESTIONS não encontrada; divisão bloqueada.');
  const literalStart = declarationAt + DECLARATION.length;
  if (source[literalStart] !== '[') throw Error('QUESTIONS não é um array literal JSON; divisão bloqueada.');
  const literalEndMarker = source.lastIndexOf(END_MARKER);
  if (literalEndMarker < literalStart) throw Error('Fechamento do array de questões não encontrado.');
  const arrayLiteral = source.slice(literalStart, literalEndMarker + 1);
  const suffix = source.slice(literalEndMarker + 1);
  if (!/^;\s*export const questionsForModule\s*=\s*id\s*=>\s*QUESTIONS\.filter\(q\s*=>\s*q\.moduleId===id\);\s*$/.test(suffix))
    throw Error('API pública das questões alterada; divisão bloqueada para proteger compatibilidade.');
  let questions;
  try { questions = JSON.parse(arrayLiteral); }
  catch (error) { throw Error(`Não foi possível interpretar o array de questões como JSON: ${error.message}`); }
  if (!Array.isArray(questions) || !questions.length) throw Error('Array de questões vazio ou inválido.');

  const groups = new Map();
  const usedIds = new Set();
  for (const q of questions) {
    if (!q || typeof q !== 'object' || !MODULE_ID_PATTERN.test(q.moduleId) || !ID_PATTERN.test(q.id))
      throw Error('Questão sem ID ou módulo técnico reconhecido; divisão bloqueada.');
    if (usedIds.has(q.id)) throw Error(`ID duplicado na fonte: ${q.id}`);
    usedIds.add(q.id);
    if (!groups.has(q.moduleId)) groups.set(q.moduleId, []);
    groups.get(q.moduleId).push(q);
  }
  // Nossa fonte está organizada sequencialmente por módulo. Requeremos essa
  // propriedade para garantir que a ordem global das questões não se altere.
  const flattened = [...groups.values()].flat();
  deepStrictEqual(flattened, questions, 'A fonte intercala módulos; manter a ordem original exigiria um mapa de posições.');

  const files = new Map();
  const imports = [];
  const spreads = [];
  const manifestModules = [];
  for (const [id, items] of groups) {
    const file = `questions-modules/${id}.js`;
    const alias = variableName(id);
    files.set(file, `/** Gerado da fonte ${sourceBlobSha}. Não editar: gere novamente a partir da origem aprovada. */\nexport const QUESTIONS = ${JSON.stringify(items, null, 2)};\n`);
    imports.push(`import { QUESTIONS as ${alias} } from './${file}';`);
    spreads.push(`  ...${alias}`);
    manifestModules.push({ id, file, count: items.length, idSha256: sha256(items.map(q => q.id).join('\n')) });
  }
  const facade = source.slice(0, declarationAt)
    + imports.join('\n')
    + '\n\nexport const QUESTIONS = [\n'
    + spreads.join(',\n')
    + '\n]'
    + suffix;
  const manifest = {
    format: 'estudo-concursos/admin-question-modules/v1',
    sourceBlobSha,
    questionCount: questions.length,
    moduleCount: groups.size,
    dataSha256: sha256(JSON.stringify(questions)),
    modules: manifestModules
  };
  return { facade, files, manifest, originalQuestions: questions };
}

/** Resumo técnico de integridade: contabiliza o catálogo final sem modificar questões. */
export function summarizeCompleteBank(baseManifest, finalQuestions, batches, {expectedCount=null}={}) {
  if (!Array.isArray(finalQuestions)) throw Error('Banco final inválido.');
  const unique = new Set();
  const totals = new Map();
  for (const q of finalQuestions) {
    if (!q || typeof q.id !== 'string' || unique.has(q.id))
      throw Error(`Questão final sem ID ou ID duplicado: ${q?.id}`);
    unique.add(q.id);
    if (!MODULE_ID_PATTERN.test(q.moduleId)) throw Error(`Módulo final desconhecido: ${q.moduleId}`);
    totals.set(q.moduleId, (totals.get(q.moduleId)||0)+1);
  }
  if (expectedCount !== null && finalQuestions.length !== expectedCount)
    throw Error(`Banco administrativo incompleto: esperadas ${expectedCount} questões, encontradas ${finalQuestions.length}.`);
  const baseCount = baseManifest.questionCount;
  const addedCount = finalQuestions.length - baseCount;
  if (addedCount < 0 || batches.reduce((n,b)=>n+b.added,0) !== addedCount)
    throw Error('Quantidade dos lotes adicionais diferente do total do banco.');
  const modules = baseManifest.modules.map(m => {
    const totalCount = totals.get(m.id)||0;
    if (totalCount < m.count) throw Error(`Faltam questões do módulo ${m.id}.`);
    return {...m, baseCount:m.count, additionalCount:totalCount-m.count, totalCount};
  });
  if (modules.reduce((n,m)=>n+m.totalCount,0) !== finalQuestions.length)
    throw Error('Existem questões de módulos não registrados no manifesto.');
  return {
    ...baseManifest,
    format:'estudo-concursos/admin-question-modules/v2',
    baseQuestionCount:baseCount,
    additionalQuestionCount:addedCount,
    questionCount:finalQuestions.length,
    totalQuestionCount:finalQuestions.length,
    fullDataSha256:sha256(JSON.stringify(finalQuestions)),
    batches,
    modules
  };
}

async function main() {
  const root = process.argv[2];
  if (!root) throw Error('Informe a pasta administrativa montada dentro de dist/.');
  const destination = resolve(root);
  if (!destination.includes('/dist/'))
    throw Error('Por segurança, a divisão só pode alterar uma pasta sob dist/. O repositório original permanece intocado.');
  const sourceFile = join(destination, 'js/data/questions.js');
  const source = readFileSync(sourceFile, 'utf8');
  const result = planQuestionSplit(source, { expectedBlobSha: EXPECTED_QUESTION_BLOB_SHA });
  const outDir = join(destination, 'js/data/questions-modules');
  mkdirSync(outDir, { recursive: true });
  for (const [relative, content] of result.files) {
    writeFileSync(join(destination, 'js/data', relative), content, 'utf8');
  }
  writeFileSync(sourceFile, result.facade, 'utf8');
  // Confere a API executável, incluindo a ordem original e todos os dados da base.
  const imported = await import(pathToFileURL(sourceFile).href);
  deepStrictEqual(imported.QUESTIONS, result.originalQuestions, 'O arquivo regenerado alterou os dados das questões.');
  for (const module of result.manifest.modules) {
    equal(imported.questionsForModule(module.id).length, module.count, `Contagem-base divergente em ${module.id}`);
  }
  // Simula a ordem real de inicialização: os quatro lotes F25 entram antes
  // da revisão F23, que não acrescenta questões, apenas revisa registros.
  const batches = [];
  for (const spec of OVERLAY_BATCHES) {
    const path = join(destination,'js/data',spec.file);
    const module = await import(pathToFileURL(path).href);
    const report = module[spec.resultName];
    if (!report || report.planned !== spec.expected || report.added !== spec.expected)
      throw Error(`Lote adicional incompleto: ${spec.file}; esperado ${spec.expected}, recebido ${report?.added ?? 'indisponível'}.`);
    batches.push({file:spec.file,planned:report.planned,added:report.added});
  }
  await import(pathToFileURL(join(destination,'js/data/questions-f23-lote02.js')).href);
  const manifest = summarizeCompleteBank(result.manifest, imported.QUESTIONS, batches,
    {expectedCount:EXPECTED_TOTAL_QUESTIONS});
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log(`Fase 4 validada: ${manifest.baseQuestionCount} questões-base modularizadas em ${manifest.moduleCount} módulos.`);
  console.log(`Banco completo: ${manifest.totalQuestionCount} questões distintas (${manifest.additionalQuestionCount} dos quatro lotes F25).`);
  console.log(`SHA-256 do banco completo: ${manifest.fullDataSha256}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error('[Fase 4] Publicação bloqueada:', error.message); process.exitCode = 1; });
}
