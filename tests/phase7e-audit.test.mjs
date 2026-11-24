import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPedagogyIndex} from '../scripts/build-admin-pedagogy-index.mjs';
import {auditPhase7E,buildPhase7EBackup,readRecoveryForAudit,PHASE7E_BACKUP_FORMAT,PHASE7E_KEYS} from '../site/js/unificado/phase7e-audit.js';
import {planPedagogyImport,PEDAGOGY_STORAGE_KEY} from '../site/js/unificado/admin-pedagogy.js';
import {createTrainingState,recordTrainingAttempt,TRAINING_KEY} from '../site/js/unificado/training-engine.js';
import {renderAdminTraining} from '../site/js/unificado/admin-training-ui.js';
import {verifyParity,buildParityFixture,randomSource} from '../scripts/audit-phase7e-parity.mjs';
const now='2026-11-24T18:00:00.000Z',earlier='2026-11-21T10:00:00.000Z';
const ids=[...Array.from({length:12},(_,i)=>`ADM-${String(i+1).padStart(2,'0')}`),'AP-13','AP-14',
  ...Array.from({length:13},(_,i)=>`DA-${String(i+15).padStart(2,'0')}`)];
const modules=ids.map(id=>({id,title:`Conteúdo ${id}`,area:id.split('-')[0],subtopics:[
  {id:`${id}-001`,title:'Tema 1'},{id:`${id}-002`,title:'Tema 2'}]}));
const questions=modules.flatMap((m,i)=>Array.from({length:i===0?29:28},(_,j)=>({
  id:`Q-${m.id}-${String(j).padStart(3,'0')}`,moduleId:m.id,options:['Certo','Errado'],answer:j%2
})));
const m={moduleCount:27,questionCount:757,completeBankSha256:createHash('sha256').update(JSON.stringify(questions)).digest('hex'),
  modules:modules.map(x=>({id:x.id,count:questions.filter(q=>q.moduleId===x.id).length}))};
const lessons=Object.fromEntries(modules.flatMap(x=>x.subtopics.map(t=>[t.id,{title:t.title}])));
const diagnostics=Object.fromEntries(modules.map(x=>[x.id,x.subtopics.map(t=>({subtopicId:t.id,front:'?',back:'!'}))]));
const index=buildPedagogyIndex(modules,lessons,diagnostics,questions,m);
const q=questions[0];
const source=()=>({schemaVersion:3,navigation:{currentRoute:'dashboard'},preferences:{theme:'light'},
  metadata:{createdAt:earlier,updatedAt:earlier},progress:{modules:{},lessons:{'ADM-01-001':{completed:true,rating:'sei'}},
    diagnostics:{'ADM-01':{answers:{'ADM-01-001':'sei'}}},exercises:{},
    questionHistory:{[q.id]:{lastAnswer:q.answer,bankAttempt:{lastAnswer:q.answer}}},
    flashcards:{},errors:[],reviewQueue:[]}});
function storage(initial={}){const map=new Map(Object.entries(initial)),writes=[];
  return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>{writes.push(k);map.set(k,String(v))},
    removeItem:k=>{writes.push(k);map.delete(k)},writes,map};}
const training=()=>createTrainingState(now);
const run=opts=>auditPhase7E({index,training:training(),now,...opts});

test('catálogo 27/757 e histórico vazio não são marcados como corrupção',()=>{
 const r=run();assert.equal(r.readyForManualReview,true);assert.equal(r.statistics.catalogQuestions,757);
 assert.equal(r.statistics.catalogModules,27);assert.equal(r.statistics.trainingDistinct,0);
 assert.equal(r.totals.erro,0);assert.equal(r.statistics.distinctUnion,null);
});
test('confronta presença dos mesmos IDs sem somar duas vezes',()=>{
 const st=training();recordTrainingAttempt(st,q,q.answer,{now});
 const r=run({legacy:source(),training:st});
 assert.equal(r.statistics.legacyDistinct,1);assert.equal(r.statistics.trainingDistinct,1);
 assert.equal(r.statistics.overlap,1);assert.equal(r.statistics.distinctUnion,1);
});
test('duas questões diferentes geram união de 2 IDs',()=>{
 const st=training();recordTrainingAttempt(st,questions[1],questions[1].answer,{now});
 const r=run({legacy:source(),training:st});
 assert.equal(r.statistics.overlap,0);assert.equal(r.statistics.distinctUnion,2);
});
test('cópia pedagógica compatível é reconhecida sem somar treino novo',()=>{
 const old=source(),imported=planPedagogyImport(old,index,{now:earlier});
 const st=training();recordTrainingAttempt(st,q,q.answer,{now});
 const before=structuredClone({old,imported,st,index});
 const r=run({legacy:old,training:st,imported});
 assert.equal(r.totals.erro,0);assert.ok(r.checks.some(c=>c.id==='pedagogia'&&c.status==='ok'));
 assert.deepEqual({old,imported,st,index},before);
});
test('alteração posterior no histórico original gera aviso, não modifica snapshot',()=>{
 const old=source(),imported=planPedagogyImport(old,index,{now:earlier});
 old.metadata.updatedAt=now;
 const r=run({legacy:old,imported});
 assert.ok(r.checks.some(c=>c.id==='atualizacao'&&c.status==='aviso'));
});
test('cópia pedagógica de outro catálogo é incompatível',()=>{
 const imported=planPedagogyImport(source(),index,{now:earlier});
 imported.metadata.catalogSha256='b'.repeat(64);
 const r=run({imported});
 assert.ok(r.totals.erro>=1);assert.equal(r.readyForManualReview,false);
});
test('versão inválida do motor novo é bloqueadora',()=>{
 const st=training();st.schemaVersion=10;
 const r=run({training:st});assert.ok(r.checks.some(c=>c.id==='treino'&&c.status==='erro'));
});
test('questão inexistente no catálogo vira alerta, não é excluída',()=>{
 const st=training();recordTrainingAttempt(st,{...q,id:'Q-ID-OBSOLETO'},q.answer,{now});
 const r=run({training:st});assert.equal(r.statistics.unknownIds,1);
 assert.ok(r.checks.some(c=>c.id==='correspondencia'&&c.status==='aviso'));
});
test('tentativa importada com gabarito divergente dispara aviso',()=>{
 const st=training();recordTrainingAttempt(st,q,q.answer,{now});
 st.questions[q.id].provenance={kind:'imported-legacy'};
 st.questions[q.id].history[0].correct=false;
 const r=run({training:st});assert.equal(r.statistics.revisedIds,1);
});
test('recuperação pendente gera aviso explícito em vez de excluir a cópia',()=>{
 const r=run({legacyRecovery:{format:'estudo-concursos-migration-recovery/v1'},
   pedagogyRecovery:{format:'estudo-concursos/pedagogy-recovery/v1'}});
 assert.equal(r.checks.filter(c=>c.status==='aviso').length,2);
});
test('registro de recuperação malformado é bloqueador',()=>{
 const r=run({legacyRecovery:{format:'errado'}});
 assert.equal(r.readyForManualReview,false);
 assert.ok(r.checks.some(c=>c.id==='recuperacao-tentativas'&&c.status==='erro'));
});
test('backup conserva exatamente as cinco chaves brutas, sem gravação',()=>{
 const raw={};for(const [i,key] of PHASE7E_KEYS.entries())raw[key]=i%2===0?`{ "unicode": "çá" , "n": ${i} }`:'invalid_json';
 const db=storage(raw),backup=buildPhase7EBackup(db,now);
 assert.equal(backup.format,PHASE7E_BACKUP_FORMAT);assert.equal(backup.entries.length,5);
 assert.deepEqual(Object.fromEntries(backup.entries.map(e=>[e.key,e.raw])),raw);
 assert.deepEqual(db.writes,[]);
});
test('backup não inventa arquivos se não existe progresso',()=>{
 assert.throws(()=>buildPhase7EBackup(storage(),now),/Nenhum progresso/);
});
test('recuperações com JSON inválido são sinalizadas sem descartar conteúdo',()=>{
 const db=storage({[PHASE7E_KEYS[3]]:'não é JSON'});
 const res=readRecoveryForAudit(db);assert.equal(res.legacyRecovery.format,'invalido');
 assert.deepEqual(db.writes,[]);
});
test('data inválida rejeitada no relatório e no backup',()=>{
 assert.throws(()=>run({now:'invalida'}),/Data da auditoria/);
 assert.throws(()=>buildPhase7EBackup(storage({[TRAINING_KEY]:'x'}),'invalida'),/Data do backup/);
});
test('gerador de cenários é reproduzível para auditoria no CI',()=>{
 const a=randomSource(765),b=randomSource(765);
 assert.deepEqual(Array.from({length:12},()=>a()),Array.from({length:12},()=>b()));
 const f=buildParityFixture(modules,index,30);assert.equal(f.schemaVersion,3);
 assert.equal(JSON.stringify(f),JSON.stringify(buildParityFixture(modules,index,30)));
});
test('verificador de paridade avalia os 27 módulos e bloqueia divergência',()=>{
 const same=(state,module)=>{
   // Simula a saída do motor original (no build real, a função é importada de dist/administracao).
   const {modulePedagogy}=globalTestRef;return modulePedagogy(state,index.modules.find(m=>m.id===module.id));
 };
 assert.deepEqual(verifyParity({index,modules,originalAchievement:same,scenarios:2}),
   {scenarios:2,modules:27,compared:54,mismatches:0});
 const wrong=(state,module)=>({...same(state,module),earnedWeightedPoints:999});
 assert.throws(()=>verifyParity({index,modules,originalAchievement:wrong,scenarios:1}),/divergências/);
});
const globalTestRef=await import('../site/js/unificado/admin-pedagogy.js');
test('a rota Verificação 7E renderiza sem gravar qualquer progresso',async()=>{
 const old=source(),st=training(),db=storage({[PHASE7E_KEYS[0]]:JSON.stringify(old),[TRAINING_KEY]:JSON.stringify(st)});
 const oldStorage=globalThis.localStorage,oldFetch=globalThis.fetch;
 globalThis.localStorage=db;globalThis.fetch=async()=>({ok:true,json:async()=>index});
 try{const main={innerHTML:'inicial'};
   await renderAdminTraining(['treino-admin','auditoria'],main,()=>true);
   assert.match(main.innerHTML,/Verificação da migração/);
   assert.match(main.innerHTML,/757 questões/);
   assert.match(main.innerHTML,/Exportar os cinco registros/);
   assert.deepEqual(db.writes,[]);
 }finally{
   if(oldStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=oldStorage;
   if(oldFetch===undefined)delete globalThis.fetch;else globalThis.fetch=oldFetch;
 }
});
