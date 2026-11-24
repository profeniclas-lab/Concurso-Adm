/**
 * ESTUDO-CONCURSOS — Fase 7B: importação OPT-IN, conservadora, com recuperação.
 * Nunca escreve na chave do ADM-ESTUDO antigo. Não converte aproveitamento,
 * aulas, simulados antigos ou agendamentos entre regras pedagógicas diferentes.
 */
import {readLegacyState,validateLegacyState} from './legacy-compat.js';
import {EXISTING_ADM_KEY} from './storage-keys.js';
import {loadAdminCatalog,loadAdminQuestions} from './admin-catalog.js';
import {readTrainingState,trainingKeyFor} from './training-store.js';
import {validateTrainingState} from './training-engine.js';

export const LEGACY_MIGRATION_RECOVERY_KEY='estudoConcursos.v1.migration-recovery.administracao';
export const LEGACY_MIGRATION_FORMAT='estudo-concursos-legacy-import/v1';
const TRAINING_KEY=trainingKeyFor('administracao');
const ACCEPTED_SOURCES=new Set(['banco','revisao','simulado']);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validDate=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const validAnswer=(v,q)=>Number.isInteger(v)&&v>=0&&v<q.options.length;

/** Planejamento sem alterar os objetos recebidos, com cobertura real do catálogo. */
export async function planLegacyMigration(legacy,modern,{
  catalog=loadAdminCatalog,loadModule=loadAdminQuestions,now=new Date().toISOString()
}={}) {
  validateLegacyState(legacy);
  validateTrainingState(modern,'administracao');
  if(!validDate(now))throw Error('Data do planejamento inválida.');
  const rows=Object.entries(legacy.progress.questionHistory);
  const candidates=rows.filter(([,r])=>obj(r)&&Array.isArray(r.attempts)&&r.attempts.length);
  const counts={legacyRecords:rows.length,withAttemptEvidence:candidates.length,
    alreadyInNew:0,summaryOnly:rows.length-candidates.length,notInCatalog:0,editorialRevisions:0,
    incompatible:0,unsupportedOnly:0,partial:0,importedQuestions:0,importedAttempts:0};
  const records=Object.create(null);
  const eligible=candidates.filter(([id])=>!Object.hasOwn(modern.questions,id));
  counts.alreadyInNew=candidates.length-eligible.length;
  if(!eligible.length)return {format:LEGACY_MIGRATION_FORMAT,createdAt:now,counts,records,skipped:[],
    warning:'Não há tentativas detalhadas antigas para importar sem inventar respostas.'};

  const manifest=await catalog();
  if(!Array.isArray(manifest?.modules)||manifest.moduleCount!==27||manifest.questionCount!==757)
    throw Error('O catálogo administrativo completo de 757 questões não foi encontrado. Importação bloqueada.');
  // A identificação de alguns lotes F25 não contém módulo no próprio ID.
  // Carregamos os 27 módulos APENAS durante a conferência única de migração.
  const lists=await Promise.all(manifest.modules.map(m=>loadModule(m.id)));
  const lookup=new Map();
  for(let i=0;i<lists.length;i++){
    for(const q of lists[i]){
      if(!q||typeof q.id!=='string'||q.moduleId!==manifest.modules[i].id||
         !Array.isArray(q.options)||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length||lookup.has(q.id))
        throw Error('O catálogo possui questões incompatíveis ou IDs repetidos; importação bloqueada.');
      lookup.set(q.id,q);
    }
  }
  if(lookup.size!==manifest.questionCount)throw Error('Nem todas as 757 questões estão disponíveis; importação bloqueada.');
  const skipped=[];
  for(const [id,old] of eligible){
    const q=lookup.get(id);
    if(!q){counts.notInCatalog++;skipped.push({id,reason:'Questão não encontrada na versão atual.'});continue;}
    if(q.pedagogicalRevision){counts.editorialRevisions++;skipped.push({id,reason:'Questão com revisão editorial: equivalência da resposta antiga não é garantida.'});continue;}
    const allowed=[],unsupported=[];
    let invalid=false;
    for(const attempt of old.attempts){
      if(!obj(attempt)){invalid=true;break;}
      if(!ACCEPTED_SOURCES.has(attempt.source)){unsupported.push(attempt);continue;}
      if(!validDate(attempt.at)||!validAnswer(attempt.answer,q)||
         typeof attempt.correct!=='boolean'||attempt.correct!==(attempt.answer===q.answer)){
        invalid=true;break;
      }
      allowed.push({at:attempt.at,answer:attempt.answer,correct:attempt.correct,
        source:`legado-${attempt.source}`});
    }
    // Se os resultados históricos não coincidirem com a versão editorial atual,
    // a questão inteira fica no legado para evitar resultados errados.
    if(invalid){counts.incompatible++;skipped.push({id,reason:'Tentativa incompleta ou divergente do gabarito atual.'});continue;}
    if(!allowed.length){counts.unsupportedOnly++;continue;}
    if(unsupported.length)counts.partial++;
    const last=allowed.at(-1);
    let streak=0;for(let i=allowed.length-1;i>=0&&allowed[i].correct;i--)streak++;
    records[id]={moduleId:q.moduleId,attempts:allowed.length,
      correct:allowed.filter(x=>x.correct).length,lastAnswer:last.answer,
      lastCorrect:last.correct,updatedAt:last.at,
      everWrong:allowed.some(x=>!x.correct),streak,
      // NÃO transferimos agenda: as regras antiga e nova são diferentes.
      dueAt:null,history:allowed,
      provenance:{kind:'imported-legacy',sourceKey:EXISTING_ADM_KEY,
        sourceField:'progress.questionHistory.attempts',importedAt:now,
        skippedUnsupportedAttempts:unsupported.length}};
    counts.importedQuestions++;counts.importedAttempts+=allowed.length;
  }
  return {format:LEGACY_MIGRATION_FORMAT,createdAt:now,counts,records,skipped,
    warning:'A importação não transfere aulas, aproveitamento ponderado, flashcards, simulados anteriores ou agendamentos antigos.'};
}

/** Faz a leitura + plano, capturando EXATAMENTE os dois estados de origem. */
export async function prepareLegacyMigration({storage=globalThis.localStorage,catalog,loadModule,now}={}) {
  const old=readLegacyState(storage);
  if(!old.ok)throw Error(old.message);
  if(!old.exists)throw Error('Não há histórico do ADM-ESTUDO original neste navegador.');
  const newState=readTrainingState(storage);
  if(!newState.ok)throw Error(newState.message);
  if(storage.getItem(LEGACY_MIGRATION_RECOVERY_KEY)!==null)
    throw Error('Já existe uma cópia de recuperação de outra importação. Nenhuma nova importação foi iniciada.');
  const plan=await planLegacyMigration(old.state,newState.state,{catalog,loadModule,now});
  return {...plan,legacyRaw:old.raw,trainingRaw:newState.raw};
}

/**
 * Confere as duas chaves ANTES de escrever e cria recuperação ANTES da migração.
 * A confirmação da cópia de segurança deve acontecer na interface, por ação explícita.
 */
export function commitLegacyMigration(draft,{
  storage=globalThis.localStorage,backupConfirmed=false,now=new Date().toISOString()
}={}) {
  if(!backupConfirmed)return {ok:false,message:'Confirme antes que salvou o backup em local seguro.'};
  if(!draft||draft.format!==LEGACY_MIGRATION_FORMAT||!obj(draft.records)||!validDate(now))
    return {ok:false,message:'Planejamento inválido. Refaça a prévia.'};
  if(!draft.counts?.importedQuestions)return {ok:false,message:'Não há tentativas elegíveis para importar.'};
  try{
    if(storage.getItem(LEGACY_MIGRATION_RECOVERY_KEY)!==null)
      return {ok:false,message:'Uma recuperação anterior já existe. Importação bloqueada.'};
    if(storage.getItem(EXISTING_ADM_KEY)!==draft.legacyRaw||storage.getItem(TRAINING_KEY)!==draft.trainingRaw)
      return {ok:false,message:'Um dos históricos mudou depois da prévia. Refaça a conferência antes de importar.'};
    const current=draft.trainingRaw===null
      ?{schemaVersion:1,subjectId:'administracao',metadata:{createdAt:now,updatedAt:null},questions:{},session:null,simulations:[]}
      :JSON.parse(draft.trainingRaw);
    validateTrainingState(current,'administracao');
    const updated=structuredClone(current);
    for(const [id,record] of Object.entries(draft.records)){
      if(Object.hasOwn(updated.questions,id))
        return {ok:false,message:'Conflito entre questões. Refaça a prévia.'};
      Object.defineProperty(updated.questions,id,{value:structuredClone(record),enumerable:true,configurable:true,writable:true});
    }
    const importId=`legacy-${Date.parse(now)}`;
    updated.metadata={...updated.metadata,updatedAt:now,legacyMigrationId:importId};
    validateTrainingState(updated,'administracao');
    const serialized=JSON.stringify(updated);
    const recovery={format:'estudo-concursos-migration-recovery/v1',createdAt:now,
      previousTrainingRaw:draft.trainingRaw,afterTrainingRaw:serialized,importId,appliedAt:now,
      importedQuestions:draft.counts.importedQuestions};
    const recoverySerialized=JSON.stringify(recovery);
    storage.setItem(LEGACY_MIGRATION_RECOVERY_KEY,recoverySerialized);
    if(storage.getItem(LEGACY_MIGRATION_RECOVERY_KEY)!==recoverySerialized)
      throw Error('Não foi possível confirmar a cópia automática de recuperação.');
    // Segunda verificação contra edições em outra aba.
    if(storage.getItem(EXISTING_ADM_KEY)!==draft.legacyRaw||storage.getItem(TRAINING_KEY)!==draft.trainingRaw)
      throw Error('Os históricos mudaram durante a operação. A gravação da importação foi bloqueada.');
    storage.setItem(TRAINING_KEY,serialized);
    if(storage.getItem(TRAINING_KEY)!==serialized)
      throw Error('A gravação não pôde ser confirmada. A recuperação anterior foi preservada.');
    return {ok:true,importedQuestions:draft.counts.importedQuestions,importedAttempts:draft.counts.importedAttempts};
  }catch(error){return {ok:false,message:`Importação interrompida: ${String(error.message||error)}. Confira a recuperação antes de repetir.`};}
}

export function inspectMigrationRecovery(storage=globalThis.localStorage) {
  const raw=storage.getItem(LEGACY_MIGRATION_RECOVERY_KEY);
  if(raw===null)return {exists:false,canRestore:false};
  try{
    const saved=JSON.parse(raw);
    if(saved.format!=='estudo-concursos-migration-recovery/v1')throw Error('Formato não reconhecido');
    const currentRaw=storage.getItem(TRAINING_KEY);
    const current=currentRaw?JSON.parse(currentRaw):null;
    return {exists:true,canDiscardUnapplied:currentRaw===saved.previousTrainingRaw,
      canRestore:Boolean(currentRaw===saved.afterTrainingRaw &&
      current?.metadata?.legacyMigrationId===saved.importId &&
      current?.metadata?.updatedAt===saved.appliedAt),createdAt:saved.createdAt,
      importedQuestions:saved.importedQuestions};
  }catch{return {exists:true,canRestore:false,message:'Cópia de recuperação incompatível; nada foi alterado.'};}
}

/** Volta apenas a chave NOVA ao valor anterior; jamais altera a chave antiga. */
export function restorePreMigration({storage=globalThis.localStorage,confirmed=false}={}) {
  if(!confirmed)return {ok:false,message:'Restauração não confirmada.'};
  const info=inspectMigrationRecovery(storage);
  if(!info.exists||!info.canRestore)return {ok:false,message:'Não é seguro restaurar: houve nova atividade ou a cópia é incompatível.'};
  try{
    const backup=JSON.parse(storage.getItem(LEGACY_MIGRATION_RECOVERY_KEY));
    if(backup.previousTrainingRaw===null)storage.removeItem(TRAINING_KEY);
    else storage.setItem(TRAINING_KEY,backup.previousTrainingRaw);
    if(storage.getItem(TRAINING_KEY)!==backup.previousTrainingRaw)
      throw Error('Verificação da restauração falhou.');
    // Uma vez restaurado exatamente o valor anterior, libera nova prévia.
    storage.removeItem(LEGACY_MIGRATION_RECOVERY_KEY);
    return {ok:true,message:'Histórico novo restaurado ao estado anterior à importação. O ADM-ESTUDO original não mudou.'};
  }catch(error){return {ok:false,message:String(error.message||error)};}
}

/** Limpa apenas um backup órfão de uma operação que NUNCA foi aplicada. */
export function discardUnappliedRecovery({storage=globalThis.localStorage,confirmed=false}={}) {
  if(!confirmed)return {ok:false,message:'Limpeza não confirmada.'};
  const info=inspectMigrationRecovery(storage);
  if(!info.exists||!info.canDiscardUnapplied)return {ok:false,message:'A recuperação não está comprovadamente sem aplicação.'};
  try{storage.removeItem(LEGACY_MIGRATION_RECOVERY_KEY);return {ok:true,message:'Cópia de operação não aplicada liberada. Os dois históricos permaneceram iguais.'};}
  catch(error){return {ok:false,message:String(error.message||error)};}
}
