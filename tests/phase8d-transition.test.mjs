import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileBankEvidence} from '../site/js/unificado/shared-bank-reconciliation.js';
import {createTrainingState,recordTrainingAttempt} from '../site/js/unificado/training-engine.js';
import {calculateSharedModuleProgress} from '../site/js/unificado/shared-progress.js';
import {createSharedActivityState} from '../site/js/unificado/shared-activity-store.js';
import {selectSharedDashboardPage,computeSharedDashboardPage,renderSharedAdminDashboard} from '../site/js/unificado/shared-dashboard.js';
const id='ADM-01',oldTime='2026-11-20T12:00:00.000Z',now='2026-11-24T12:00:00.000Z';
const questions=[0,1,2].map(i=>({id:`Q-${id}-00${i+1}`,moduleId:id,options:['A','B'],answer:1,stem:'Exemplo'}));
const last=(answer,at=oldTime)=>({bankAttempt:{lastAnswer:answer,updatedAt:at}});
const old={questionHistory:{[questions[0].id]:last(0),[questions[1].id]:last(1)}};
const bank={available:true,score:50,coverage:100};
const native=(q=questions[0],answer=q.answer)=>{const s=createTrainingState(now);recordTrainingAttempt(s,q,answer,{now,source:'bank'});return s;};
const check=(progress=old,training=native(),source='legacy',originalBank=bank)=>reconcileBankEvidence({moduleId:id,questions,
 baselineProgress:progress,training,source,originalBank});
test('conciliação por ID substitui a resposta antiga MAIS VELHA, sem duplicar o ID',()=>{
 const before=structuredClone(old),state=native(),copy=structuredClone(state);
 const r=check(old,state);
 assert.equal(r.status,'merged');assert.equal(r.oldCount,2);assert.equal(r.nativeCount,1);
 assert.equal(r.overlap,1);assert.equal(r.total,2);assert.equal(r.correct,2);
 assert.equal(r.component.score,100);assert.deepEqual(old,before);assert.deepEqual(state,copy);
});
test('resposta antiga mais recente tem precedência',()=>{
 const other={questionHistory:{[questions[0].id]:last(0,'2026-11-25T00:00:00.000Z'),[questions[1].id]:last(1)}};
 const r=check(other);assert.equal(r.status,'merged');assert.equal(r.correct,1);assert.equal(r.component.score,50);
});
test('novo ID acrescenta uma questão, não duplica as existentes',()=>{
 const r=check(old,native(questions[2],1));
 assert.equal(r.status,'merged');assert.equal(r.overlap,0);assert.equal(r.total,3);
 assert.equal(r.component.score,200/3);
});
test('cópia F7C agregada não inventa IDs: mantém Banco congelado',()=>{
 const r=check({diagnostics:{},lessons:{},exercises:{}},native(),'imported');
 assert.equal(r.status,'frozen');assert.equal(r.applied,false);assert.equal(r.component,null);
 assert.match(r.reason,/F7C/);
});
test('sem evidência antiga a nota usa somente respostas novas do Banco',()=>{
 const r=check({},native(),'none',null);assert.equal(r.status,'native-only');assert.equal(r.component.score,100);
});
test('resposta antiga sem data na sobreposição não é atualizada artificialmente',()=>{
 const rec={questionHistory:{[questions[0].id]:{bankAttempt:{lastAnswer:0}},[questions[1].id]:last(1)}};
 const r=check(rec);assert.equal(r.status,'frozen');assert.equal(r.applied,false);
});
test('datas empatadas bloqueiam a conciliação',()=>{
 const rec={questionHistory:{[questions[0].id]:last(0,now),[questions[1].id]:last(1)}};
 const r=check(rec);assert.equal(r.status,'frozen');
});
test('evidência antiga divergente da nota é bloqueada',()=>{
 const r=check(old,native(),'legacy',{available:true,score:75,coverage:100});
 assert.equal(r.status,'frozen');
});
test('tentativas importadas do legado não são recontadas como Banco novo',()=>{
 const s=createTrainingState(now);s.questions[questions[0].id]={moduleId:id,attempts:1,correct:0,
  history:[{source:'legado-banco',at:oldTime,answer:0,correct:false}]};
 const r=check(old,s);assert.equal(r.status,'unchanged');
});
test('resposta de exercício não adiciona pontos do Banco',()=>{
 const s=createTrainingState(now);recordTrainingAttempt(s,questions[0],1,{now,source:'exercise'});
 const r=check(old,s);assert.equal(r.status,'unchanged');
});
test('histórico fora do catálogo suspende a conciliação',()=>{
 const s=native();recordTrainingAttempt(s,{id:'EXTRA',moduleId:id,options:['A','B'],answer:1},1,{now,source:'bank'});
 const r=check(old,s);assert.equal(r.status,'frozen');
});
test('componente calculado do módulo respeita 75 pontos e mantém outros pesos',()=>{
 const bundle={subjectId:'administracao',moduleId:id,lessons:{},diagnostic:[],subtopics:[]};
 const base={hasData:true,earnedWeightedPoints:10,components:{bank:{available:true,score:50,coverage:100}}};
 const st=native();const shared=createSharedActivityState('administracao',{now});
 const result=calculateSharedModuleProgress(bundle,old,base,shared,{training:st,questions,baselineSource:'legacy'});
 assert.equal(result.components.bank.points,20);assert.equal(result.earnedWeightedPoints,20);
 assert.equal(result.completed,false);assert.equal(result.bankReconciliation.total,2);
});
test('sem novas tentativas preserva pontuação original completa',()=>{
 const bundle={subjectId:'administracao',moduleId:id,lessons:{},diagnostic:[],subtopics:[]};
 const base={hasData:true,earnedWeightedPoints:75,completed:true,components:{bank}};
 const result=calculateSharedModuleProgress(bundle,old,base,createSharedActivityState('administracao',{now}),
  {training:createTrainingState(now),questions,baselineSource:'legacy'});
 assert.equal(result.earnedWeightedPoints,75);
});
const manifest=()=>({moduleCount:27,questionCount:757,modules:Array.from({length:27},(_,i)=>({
 id:`ADM-${String(i+1).padStart(2,'0')}`,title:'Tema '+i}))});
test('painel efetivo pagina 9 módulos e não inventa contagem global de metas',()=>{
 const x=selectSharedDashboardPage(manifest(),2);assert.equal(x.total,27);assert.equal(x.pages,3);
 assert.equal(x.items[0].id,'ADM-10');assert.equal(x.items.length,9);
 assert.throws(()=>selectSharedDashboardPage(manifest(),4),/não encontrada/);
});
test('painel efetivo calcula a nota apenas com uma fonte e reconhece módulo bloqueado',async()=>{
 const r=await computeSharedDashboardPage(manifest(),1,{moduleLoader:async(_,mod)=>({moduleId:mod,subjectId:'administracao',title:mod}),
  viewLoader:async b=>b.moduleId==='ADM-02'?{locked:true,reason:'Mudança de origem'}:
   {locked:false,source:'legacy',score:{hasData:true,earnedWeightedPoints:b.moduleId==='ADM-01'?75:40,completed:b.moduleId==='ADM-01'}}});
 assert.equal(r.checked,9);assert.equal(r.atGoal,1);assert.equal(r.errors,1);
 assert.equal(r.rows[1].locked,true);
});
test('renderizador mostra 9 módulos e mantém link ao legado',async()=>{
 const main={innerHTML:''};await renderSharedAdminDashboard(1,main,()=>true,{manifestLoader:async()=>manifest(),
 moduleLoader:async(_,mod)=>({moduleId:mod,subjectId:'administracao',title:mod}),
 viewLoader:async()=>({locked:false,source:'none',score:{hasData:false,completed:false,sourceChanged:false}})});
 assert.match(main.innerHTML,/Aproveitamento atualizado/);assert.match(main.innerHTML,/materia\/administracao\/legado/);
 assert.equal((main.innerHTML.match(/Abrir módulo unificado/g)||[]).length,9);
});
test('navegação concorrente não substitui página após mudança de rota',async()=>{
 const main={innerHTML:'nova rota'};let n=0;
 await renderSharedAdminDashboard(1,main,()=>++n===1,{manifestLoader:async()=>manifest()});
 assert.equal(main.innerHTML,'nova rota');
});
test('nova entrada da Administração é nativa e a versão antiga continua como alternativa',()=>{
 const app=readFileSync(new URL('../site/js/unificado/app.js',import.meta.url),'utf8');
 assert.match(app,/renderAdminNative\(subject,token\)/);
 assert.match(app,/route\[2\]==='legado'/);
 assert.match(app,/<iframe id="admin-frame"/);
 assert.match(app,/#estudo\/administracao\/\$\{esc\(m.id\)\}/);
});
test('build mantém verificações da Fase 7E, 8B, 8C e inclui a Fase 8D',()=>{
 const source=readFileSync(new URL('../scripts/build-site.sh',import.meta.url),'utf8');
 for(const tag of ['audit-phase7e-parity.mjs','audit-phase8b-parity.mjs','audit-phase8c-integration.mjs','audit-phase8d-transition.mjs'])assert.ok(source.includes(tag));
});
