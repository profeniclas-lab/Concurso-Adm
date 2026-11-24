/**
 * ESTUDO-CONCURSOS — Fase 7E: auditoria de migração, SOMENTE LEITURA.
 * Não modifica o ADM-ESTUDO, a área de treino, a cópia pedagógica ou recuperações.
 * Resultado técnico não substitui a conferência do progresso real no aplicativo original.
 */
import {validatePedagogyIndex, PEDAGOGY_STORAGE_KEY, PEDAGOGY_RECOVERY_KEY} from './admin-pedagogy.js';
import {assertCompatiblePedagogySnapshot} from './admin-module-progress.js';
import {validateTrainingState} from './training-engine.js';
import {validateLegacyState,legacyAnsweredQuestionIds} from './legacy-compat.js';
import {EXISTING_ADM_KEY} from './storage-keys.js';
import {trainingKeyFor} from './training-store.js';
import {LEGACY_MIGRATION_RECOVERY_KEY} from './legacy-migration.js';
import {ADMIN_SHARED_ACTIVITY_KEY} from './shared-activity-store.js';

export const PHASE7E_BACKUP_FORMAT='estudo-concursos/phase7e-complete-backup/v1';
export const PHASE7E_KEYS=Object.freeze([
  EXISTING_ADM_KEY,
  trainingKeyFor('administracao'),
  PEDAGOGY_STORAGE_KEY,
  LEGACY_MIGRATION_RECOVERY_KEY,
  PEDAGOGY_RECOVERY_KEY,
  ADMIN_SHARED_ACTIVITY_KEY
]);
const isObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const validDate=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const result=(id,status,detail)=>({id,status,detail});

/**
 * A auditoria valida estrutura, proveniência e unicidade. Ela NÃO reinterpreta
 * taxas de acerto entre motores nem afirma equivalência editorial por ID.
 */
export function auditPhase7E({index,legacy=null,training,imported=null,
  legacyRecovery=null,pedagogyRecovery=null,now=new Date().toISOString()}={}) {
  if(!validDate(now))throw Error('Data da auditoria inválida.');
  const checks=[];
  const add=(id,status,detail)=>checks.push(result(id,status,detail));
  let validIndex=false,validTraining=false,validLegacy=false,validImported=false;
  try{validatePedagogyIndex(index);validIndex=true;
    add('catalogo','ok','Índice administrativo: 27 módulos, 757 questões e IDs distintos.');
  }catch(e){add('catalogo','erro',`Índice incompatível: ${e.message}`);}
  try{validateTrainingState(training,'administracao');validTraining=true;
    add('treino','ok','Estrutura do histórico do treino novo reconhecida.');
  }catch(e){add('treino','erro',`Histórico novo incompatível: ${e.message}`);}
  if(legacy===null)add('legado','info','Progresso ADM-ESTUDO original ausente neste navegador.');
  else try{validateLegacyState(legacy);validLegacy=true;
    add('legado','ok','Histórico ADM-ESTUDO original reconhecido sem alterações.');
  }catch(e){add('legado','erro',`Histórico original incompatível: ${e.message}`);}
  if(imported===null)add('pedagogia','info','Nenhuma cópia pedagógica da Fase 7C neste navegador.');
  else if(!validIndex)add('pedagogia','aviso','Não é possível confrontar a cópia pedagógica sem índice válido.');
  else try{assertCompatiblePedagogySnapshot(imported,index);validImported=true;
    add('pedagogia','ok','Cópia Fase 7C válida para a versão atual do catálogo; notas congeladas.');
    if(validLegacy && imported.metadata.sourceUpdatedAt!==legacy.metadata.updatedAt)
      add('atualizacao','aviso','O ADM-ESTUDO mudou desde a importação: a nota herdada pode estar desatualizada.');
    else if(validLegacy)
      add('atualizacao','info','Datas de atualização coincidem; isso não prova igualdade integral dos dados.');
  }catch(e){add('pedagogia','erro',`Cópia pedagógica incompatível: ${e.message}`);}

  let overlap=0,distinctUnion=null,trainingDistinct=null,legacyDistinct=null,unknownIds=0,revisedIds=0;
  if(validIndex&&validTraining){
    const bank=new Map(index.modules.flatMap(m=>m.bank.map(q=>[q.id,{moduleId:m.id,answer:q.answer,optionCount:q.optionCount}])));
    trainingDistinct=Object.keys(training.questions).length;
    for(const [id,item] of Object.entries(training.questions)){
      const q=bank.get(id);
      if(!q){unknownIds++;continue;}
      if(q.moduleId!==item.moduleId){revisedIds++;continue;}
      if(item.provenance?.kind==='imported-legacy'){
        if(!Array.isArray(item.history)||item.history.length!==item.attempts ||
          item.history.some(x=>!Number.isInteger(x.answer)||x.answer<0||x.answer>=q.optionCount||x.correct!==(x.answer===q.answer)))
          revisedIds++;
      }
    }
    if(unknownIds||revisedIds)add('correspondencia','aviso',`${unknownIds} IDs do treino fora do catálogo atual; ${revisedIds} registros com divergência de módulo, gabarito ou tentativas importadas. Preservados para revisão.`);
    else add('correspondencia','ok','IDs e tentativas importadas do treino são compatíveis com o catálogo atual.');
    if(validLegacy){
      const old=legacyAnsweredQuestionIds(legacy),modern=new Set(Object.keys(training.questions));
      overlap=[...old].filter(id=>modern.has(id)).length;
      legacyDistinct=old.size;
      distinctUnion=new Set([...old,...modern]).size;
      add('duplicacao','ok',`${distinctUnion} questões distintas na união por ID; ${overlap} presentes nos dois históricos, sem somá-las duas vezes.`);
    }
  }
  for(const [name,key,payload] of [
    ['recuperacao-tentativas',LEGACY_MIGRATION_RECOVERY_KEY,legacyRecovery],
    ['recuperacao-pedagogia',PEDAGOGY_RECOVERY_KEY,pedagogyRecovery]]){
    if(payload===null){add(name,'info','Nenhuma recuperação técnica pendente.');continue;}
    if(!isObject(payload)||typeof payload.format!=='string'){
      add(name,'erro','Registro técnico de recuperação não reconhecido: não excluir nem sobrescrever.');continue;
    }
    const expected=name==='recuperacao-tentativas'?'estudo-concursos-migration-recovery/v1':'estudo-concursos/pedagogy-recovery/v1';
    if(payload.format!==expected){add(name,'erro','Formato da recuperação incompatível. Preserve o backup.');continue;}
    add(name,'aviso','Recuperação técnica presente. Resolva-a na tela de Históricos/Aproveitamento antes de nova importação.');
  }
  if(validTraining&&training.session!==null)
    add('simulado-ativo','info','Há um simulado do motor novo em andamento; a auditoria não o altera.');
  const totals={ok:checks.filter(c=>c.status==='ok').length,
    aviso:checks.filter(c=>c.status==='aviso').length,
    erro:checks.filter(c=>c.status==='erro').length,
    info:checks.filter(c=>c.status==='info').length};
  return {format:'estudo-concursos/phase7e-audit/v1',checkedAt:now,
    readyForManualReview:totals.erro===0,
    totals,checks,
    statistics:{catalogModules:validIndex?index.moduleCount:null,
      catalogQuestions:validIndex?index.questionCount:null,
      legacyDistinct,trainingDistinct,overlap,distinctUnion,unknownIds,revisedIds},
    limitations:[
      'Auditoria local: só vê dados presentes neste navegador, não o Google Drive.',
      'Coincidência de IDs ou datas não demonstra equivalência editorial de versões.',
      'Aproveitamento herdado e taxa de acerto do treino continuam indicadores separados.',
      'A comparação com o motor original deve ser validada no build e com módulos reais.',
      'Esta análise não restaura, não grava e não confirma entrega estável do aplicativo.'
    ]};
}

/** Backup literal dos registros relevantes, incluindo a nova camada F8B (sem restauração automática). */
export function buildPhase7EBackup(storage=globalThis.localStorage,now=new Date().toISOString()){
  if(!validDate(now))throw Error('Data do backup inválida.');
  const entries=PHASE7E_KEYS.map(key=>({key,raw:storage.getItem(key)}));
  if(entries.every(e=>e.raw===null))throw Error('Nenhum progresso encontrado neste navegador.');
  return {format:PHASE7E_BACKUP_FORMAT,createdAt:now,subjectId:'administracao',
    note:'Cópia bruta de segurança, sem restauração automática. Não publique no GitHub.',entries};
}

/** Lê registros técnicos para exibição, sem apagar nem transformar valores inválidos. */
export function readRecoveryForAudit(storage=globalThis.localStorage){
  const parse=key=>{const raw=storage.getItem(key);if(raw===null)return null;
    try{return JSON.parse(raw);}catch{return {format:'invalido'}};};
  return {legacyRecovery:parse(LEGACY_MIGRATION_RECOVERY_KEY),
    pedagogyRecovery:parse(PEDAGOGY_RECOVERY_KEY)};
}
