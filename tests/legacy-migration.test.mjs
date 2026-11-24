import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrainingState,recordTrainingAttempt} from '../site/js/unificado/training-engine.js';
import {planLegacyMigration,prepareLegacyMigration,commitLegacyMigration,
  inspectMigrationRecovery,restorePreMigration,LEGACY_MIGRATION_RECOVERY_KEY} from '../site/js/unificado/legacy-migration.js';
import {TRAINING_KEY} from '../site/js/unificado/training-engine.js';

const NOW='2026-11-24T13:00:00.000Z',PAST='2026-11-20T11:00:00.000Z',OLD_KEY='admEstudo.v2.state';
const modules=Array.from({length:27},(_,i)=>({id:i<12?`ADM-${String(i+1).padStart(2,'0')}`:i<14?`AP-${i+1}`:`DA-${i+1}`}));
const q=(id='Q-ADM-01-123',answer=1)=>({id,moduleId:'ADM-01',options:['Errado','Certo'],answer});
const mod=()=>({questionCount:757,moduleCount:27,modules});
const questionLoader=async id=>id==='ADM-01'?[q()]:[];
const fakeCatalog=()=>({catalog:async()=>mod(),loadModule:questionLoader});
const oldState=()=>({schemaVersion:3,navigation:{currentRoute:'dashboard'},preferences:{theme:'light'},metadata:{createdAt:PAST,updatedAt:PAST},progress:{modules:{},lessons:{},diagnostics:{},exercises:{},questionHistory:{},flashcards:{},reviewQueue:[],errors:[]}});
const attempt=(answer=1,correct=true,source='banco',at=PAST)=>({answer,correct,source,at});
const memory=(obj={})=>{
 const db=new Map(Object.entries(obj));const writes=[];
 return {getItem:k=>db.has(k)?db.get(k):null,setItem:(k,v)=>{writes.push(['set',k]);db.set(k,String(v));},removeItem:k=>{writes.push(['remove',k]);db.delete(k);},writes,raw:()=>Object.fromEntries(db)};
};
const seed=(legacy=oldState(),modern=createTrainingState(NOW))=>memory({[OLD_KEY]:JSON.stringify(legacy),[TRAINING_KEY]:JSON.stringify(modern)});
const injected=(storage)=>({...fakeCatalog(),storage,now:NOW});

// Para testar 27 módulos, preenchemos IDs sintéticos sem necessidade de internet.
function fillFakeCatalog(){
 const list=Array.from({length:757},(_,i)=>({id:`Q-ADM-01-${String(i).padStart(5,'0')}`,moduleId:'ADM-01',options:['A','B'],answer:i%2}));
 return {catalog:async()=>mod(),loadModule:async id=>id==='ADM-01'?list:[] ,list};
}

test('prévia sem registros detalhados não precisa carregar catálogo',async()=>{
 const old=oldState();old.progress.questionHistory[q().id]={lastAnswer:1};let called=false;
 const result=await planLegacyMigration(old,createTrainingState(NOW),{catalog:()=>{called=true;throw Error('não deveria')},now:NOW});
 assert.equal(result.counts.summaryOnly,1);assert.equal(result.counts.importedQuestions,0);assert.equal(called,false);
});
test('importa apenas banco/revisão/simulado com datas e acertos conferidos',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState();const id=list[5].id;
 old.progress.questionHistory[id]={lastAnswer:0,attempts:[attempt(1,true,'banco'),attempt(0,false,'revisao'),attempt(1,true,'simulado')]};
 const result=await planLegacyMigration(old,createTrainingState(NOW),{...deps,now:NOW});
 assert.equal(result.counts.importedQuestions,1);assert.equal(result.counts.importedAttempts,3);
 assert.deepEqual(result.records[id].history.map(x=>x.source),['legado-banco','legado-revisao','legado-simulado']);
 assert.equal(result.records[id].dueAt,null);assert.equal(result.records[id].streak,1);
 assert.equal(result.records[id].provenance.kind,'imported-legacy');
 assert.equal(old.progress.questionHistory[id].attempts[0].source,'banco');
});
test('não recria resposta somente de lastAnswer',async()=>{
 const old=oldState();old.progress.questionHistory[q().id]={lastAnswer:1,assessment:'acerto_banco'};
 const p=await planLegacyMigration(old,createTrainingState(NOW),{now:NOW});
 assert.equal(p.counts.importedQuestions,0);assert.equal(p.counts.summaryOnly,1);
});
test('não duplica questões já praticadas no novo motor',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState(),modern=createTrainingState(NOW),id=list[3].id;
 old.progress.questionHistory[id]={attempts:[attempt(1,true)]};
 recordTrainingAttempt(modern,list[3],1,{now:NOW});
 const p=await planLegacyMigration(old,modern,{...deps,now:NOW});
 assert.equal(p.counts.alreadyInNew,1);assert.equal(p.counts.importedQuestions,0);
 assert.equal(modern.questions[id].attempts,1);
});
test('gabarito divergente exclui toda questão sem alterar legado',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState(),id=list[4].id;
 old.progress.questionHistory[id]={attempts:[attempt(0,false)]};
 const p=await planLegacyMigration(old,createTrainingState(NOW),{...deps,now:NOW});
 assert.equal(p.counts.incompatible,1);assert.equal(p.counts.importedQuestions,0);
});
test('tentativas de exercícios não são convertidas em banco',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState(),id=list[5].id;
 old.progress.questionHistory[id]={attempts:[attempt(1,true,'exercicios')]};
 const p=await planLegacyMigration(old,createTrainingState(NOW),{...deps,now:NOW});
 assert.equal(p.counts.unsupportedOnly,1);assert.equal(p.counts.importedQuestions,0);
});
test('tentativa válida de banco junto de exercício gera migração parcial explícita',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState(),id=list[5].id;
 old.progress.questionHistory[id]={attempts:[attempt(1,true,'banco'),attempt(1,true,'exercicios')]};
 const p=await planLegacyMigration(old,createTrainingState(NOW),{...deps,now:NOW});
 assert.equal(p.counts.partial,1);assert.equal(p.counts.importedAttempts,1);
 assert.equal(p.records[id].provenance.skippedUnsupportedAttempts,1);
});
test('questão de ID desconhecido permanece no legado',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState();old.progress.questionHistory['Q-F25-NO-MODULE-ID']={attempts:[attempt()]};
 const p=await planLegacyMigration(old,createTrainingState(NOW),{...deps,now:NOW});
 assert.equal(p.counts.notInCatalog,1);assert.equal(p.counts.importedQuestions,0);
});
test('catálogo incompleto bloqueia qualquer plano com candidatos',async()=>{
 const old=oldState();old.progress.questionHistory[q().id]={attempts:[attempt()]};
 await assert.rejects(planLegacyMigration(old,createTrainingState(NOW),{catalog:async()=>({...mod(),questionCount:100}),now:NOW}),/757/);
});
test('falta de questão dentre as 757 bloqueia plano',async()=>{
 const old=oldState();old.progress.questionHistory[q().id]={attempts:[attempt()]};
 await assert.rejects(planLegacyMigration(old,createTrainingState(NOW),{...fakeCatalog(),now:NOW}),/757/);
});
test('prévia completa não grava em nenhuma chave',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState(),id=list[5].id;
 old.progress.questionHistory[id]={attempts:[attempt(1,true,'banco')]};
 const db=seed(old),legacyRaw=db.getItem(OLD_KEY),trainingRaw=db.getItem(TRAINING_KEY);
 const draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 assert.equal(draft.counts.importedQuestions,1);assert.equal(draft.legacyRaw,legacyRaw);
 assert.equal(draft.trainingRaw,trainingRaw);assert.deepEqual(db.writes,[]);
});
test('sem confirmação de backup não grava',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old);const draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 const r=commitLegacyMigration(draft,{storage:db,backupConfirmed:false,now:NOW});
 assert.equal(r.ok,false);assert.deepEqual(db.writes,[]);
});
test('migração real escreve somente o treino e a recuperação, nunca o legado',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState(),id=list[5].id;
 old.progress.questionHistory[id]={attempts:[attempt(1,true)]};
 const db=seed(old),oldRaw=db.getItem(OLD_KEY),previous=db.getItem(TRAINING_KEY);
 const draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 const result=commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW});
 assert.equal(result.ok,true);assert.deepEqual(db.writes.map(x=>x[1]),[LEGACY_MIGRATION_RECOVERY_KEY,TRAINING_KEY]);
 assert.equal(db.getItem(OLD_KEY),oldRaw);
 const newState=JSON.parse(db.getItem(TRAINING_KEY));assert.equal(newState.questions[id].attempts,1);
 assert.equal(newState.questions[id].dueAt,null);
 assert.equal(JSON.parse(db.getItem(LEGACY_MIGRATION_RECOVERY_KEY)).previousTrainingRaw,previous);
});
test('conflito com alteração do histórico original bloqueia sem gravar',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old),draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 db.setItem(OLD_KEY,'{"novo":"alterado"}');const writes=db.writes.length;
 const result=commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW});
 assert.equal(result.ok,false);assert.equal(db.writes.length,writes);
});
test('conflito com treino alterado em outra aba bloqueia sem gravar',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old),draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 db.setItem(TRAINING_KEY,'{"outro":"usuario"}');const writes=db.writes.length;
 const result=commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW});
 assert.equal(result.ok,false);assert.equal(db.writes.length,writes);
});
test('segunda migração é bloqueada pela recuperação existente',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old),draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 assert.equal(commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW}).ok,true);
 await assert.rejects(prepareLegacyMigration({...deps,storage:db,now:NOW}),/recuperação/);
});
test('restauração volta exatamente ao valor anterior e preserva legado',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old),before=db.getItem(TRAINING_KEY),oldRaw=db.getItem(OLD_KEY);
 const draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 assert.equal(commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW}).ok,true);
 assert.equal(inspectMigrationRecovery(db).canRestore,true);
 assert.equal(restorePreMigration({storage:db,confirmed:true}).ok,true);
 assert.equal(db.getItem(TRAINING_KEY),before);assert.equal(db.getItem(OLD_KEY),oldRaw);
 assert.equal(inspectMigrationRecovery(db).canRestore,false);
});
test('atividade nova depois da importação bloqueia restauração',async()=>{
 const {list,...deps}=fillFakeCatalog();const old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old),draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 assert.equal(commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW}).ok,true);
 const st=JSON.parse(db.getItem(TRAINING_KEY));st.metadata.updatedAt='2026-11-25T12:00:00Z';
 db.setItem(TRAINING_KEY,JSON.stringify(st));const before=db.getItem(TRAINING_KEY);
 assert.equal(restorePreMigration({storage:db,confirmed:true}).ok,false);
 assert.equal(db.getItem(TRAINING_KEY),before);
});
test('dados antigos inválidos bloqueiam planejamento sem gravar',async()=>{
 const db=memory({[OLD_KEY]:'{erro', [TRAINING_KEY]:JSON.stringify(createTrainingState(NOW))});
 await assert.rejects(prepareLegacyMigration({...fakeCatalog(),storage:db,now:NOW}));
 assert.deepEqual(db.writes,[]);
});
test('registros antigos continuam independentes de notas, aulas e simulados',async()=>{
 const {list,...deps}=fillFakeCatalog(),old=oldState();old.progress.lessons['ADM-01-001']={completed:true};
 old.progress.simulados={history:[{id:'old-sim'}]};old.progress.reviewSchedule={'key':{dueAt:NOW}};
 old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old),draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 assert.equal(commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW}).ok,true);
 const st=JSON.parse(db.getItem(TRAINING_KEY));
 assert.equal(st.simulations.length,0);assert.equal(st.questions[list[5].id].dueAt,null);
 assert.equal(JSON.parse(db.getItem(OLD_KEY)).progress.lessons['ADM-01-001'].completed,true);
});

test('recuperação detecta alteração de respostas mesmo sem mudança no updatedAt',async()=>{
 const {list,...deps}=fillFakeCatalog(),old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old),draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 assert.equal(commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW}).ok,true);
 const after=JSON.parse(db.getItem(TRAINING_KEY));after.questions[list[5].id].attempts+=1;
 db.setItem(TRAINING_KEY,JSON.stringify(after));
 assert.equal(inspectMigrationRecovery(db).canRestore,false);
 assert.equal(restorePreMigration({storage:db,confirmed:true}).ok,false);
});

test('falha de quota antes de salvar recuperação não modifica o novo histórico',async()=>{
 const {list,...deps}=fillFakeCatalog(),old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const storage=seed(old),oldRaw=storage.getItem(OLD_KEY),newRaw=storage.getItem(TRAINING_KEY);
 const draft=await prepareLegacyMigration({...deps,storage,now:NOW});
 const wrapped={getItem:(k)=>storage.getItem(k),setItem:(k,v)=>{
   if(k===LEGACY_MIGRATION_RECOVERY_KEY)throw Error('QuotaExceededError');
   storage.setItem(k,v);
 },removeItem:(k)=>storage.removeItem(k)};
 const result=commitLegacyMigration(draft,{storage:wrapped,backupConfirmed:true,now:NOW});
 assert.equal(result.ok,false);
 assert.equal(storage.getItem(OLD_KEY),oldRaw);assert.equal(storage.getItem(TRAINING_KEY),newRaw);
});

test('sem alterar dados após importação, recuperação libera nova prévia ao restaurar',async()=>{
 const {list,...deps}=fillFakeCatalog(),old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old),draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 assert.equal(commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW}).ok,true);
 assert.equal(restorePreMigration({storage:db,confirmed:true}).ok,true);
 assert.equal(inspectMigrationRecovery(db).exists,false);
 assert.equal((await prepareLegacyMigration({...deps,storage:db,now:NOW})).counts.importedQuestions,1);
});

test('registros que já existem no novo não exigem carregar o catálogo',async()=>{
 const old=oldState(),modern=createTrainingState(NOW),id=q().id;
 old.progress.questionHistory[id]={attempts:[attempt(1,true)]};
 recordTrainingAttempt(modern,q(),1,{now:NOW});let called=false;
 const plan=await planLegacyMigration(old,modern,{catalog:()=>{called=true;throw Error('não deveria chamar')},now:NOW});
 assert.equal(called,false);assert.equal(plan.counts.alreadyInNew,1);
});

test('página Históricos oferece prévia e não grava dados apenas ao abrir',async()=>{
 const {renderAdminTraining}=await import('../site/js/unificado/admin-training-ui.js');
 const old=oldState(),db=seed(old);const oldStorage=globalThis.localStorage;
 globalThis.localStorage=db;
 try{
   const main={innerHTML:''};await renderAdminTraining(['treino-admin','compatibilidade'],main,()=>true);
   assert.match(main.innerHTML,/Fase 7B — Migração controlada/);
   assert.match(main.innerHTML,/data-train-action="migration-preview"/);
   assert.doesNotMatch(main.innerHTML,/data-train-action="migration-commit"/);
   assert.deepEqual(db.writes,[]);
 }finally{if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;}
});

test('após migração a tela Históricos oferece recuperação se segura',async()=>{
 const {renderAdminTraining}=await import('../site/js/unificado/admin-training-ui.js');
 const {list,...deps}=fillFakeCatalog(),old=oldState();old.progress.questionHistory[list[5].id]={attempts:[attempt(1,true)]};
 const db=seed(old),draft=await prepareLegacyMigration({...deps,storage:db,now:NOW});
 assert.equal(commitLegacyMigration(draft,{storage:db,backupConfirmed:true,now:NOW}).ok,true);
 const oldStorage=globalThis.localStorage;globalThis.localStorage=db;
 try{
   const main={innerHTML:''};await renderAdminTraining(['treino-admin','compatibilidade'],main,()=>true);
   assert.match(main.innerHTML,/data-train-action="migration-restore"/);
   assert.doesNotMatch(main.innerHTML,/data-train-action="migration-preview"/);
 }finally{if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;}
});


test('revisão editorial sinalizada impede importar resposta antiga mesmo com índice igual',async()=>{
 const {list,...deps}=fillFakeCatalog(),old=oldState(),id=list[5].id;
 old.progress.questionHistory[id]={attempts:[attempt(1,true)]};
 const wrapped={...deps,loadModule:async module=>{const questions=await deps.loadModule(module);return questions.map(x=>x.id===id?{...x,pedagogicalRevision:'F23-L02'}:x);}};
 const plan=await planLegacyMigration(old,createTrainingState(NOW),{...wrapped,now:NOW});
 assert.equal(plan.counts.editorialRevisions,1);assert.equal(plan.counts.importedQuestions,0);
});
