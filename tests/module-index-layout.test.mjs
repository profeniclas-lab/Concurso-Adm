import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSharedModule} from '../site/js/unificado/shared-module-ui.js';

const rawBundle=()=>({
 format:'estudo-concursos/shared-module/v1',subjectId:'administracao',moduleId:'ADM-01',title:'Fundamentos',questionCount:30,
 subtopics:[
  {id:'ADM-01-001',title:'Primeiro subtópico'},
  {id:'ADM-01-002',title:'Segundo subtópico'},
  {id:'ADM-01-003',title:'Terceiro subtópico'}
 ],
 lessons:{'ADM-01-001':{concept:'Conceito'},'ADM-01-002':{concept:'Conceito 2'},'ADM-01-003':{concept:'Conceito 3'}},
 diagnostic:[
  {subtopicId:'ADM-01-001',front:'Frente 1',back:'Verso 1'},
  {subtopicId:'ADM-01-002',front:'Frente 2',back:'Verso 2'},
  {subtopicId:'ADM-01-003',front:'Frente 3',back:'Verso 3'}]
});
const rawView=()=>({locked:false,source:'legacy',score:{hasData:true,earnedWeightedPoints:35,completed:false,sourceChanged:false,
 evidence:{diagnostics:1,diagnosticsTotal:3,lessonsDone:1,lessonsTotal:3,lessonsRated:1},
 subtopics:{'ADM-01-001':{diagnostic:'sei',completed:true,lessonOrigin:'herdado',lessonRating:'sei'},
 'ADM-01-002':{diagnostic:null,completed:false},'ADM-01-003':{diagnostic:null,completed:false}},
 liveExercise:{answered:3,total:9,correct:2},liveBank:{answered:4,score:50,applied:false}}});
async function render(route=['estudo','administracao','ADM-01'],view=rawView(),bundle=rawBundle()){
 const main={innerHTML:''};
 await renderSharedModule(route,main,()=>true,async()=>bundle,async()=>view);
 return main.innerHTML;
}

test('índice mostra um único diagnóstico geral, exercícios e Banco em um único painel',async()=>{
 const html=await render();
 assert.match(html,/<h2>Atividades do módulo<\/h2>/);
 assert.equal((html.match(/href="#estudo\/administracao\/ADM-01\/diagnostico\//g)||[]).length,1);
 assert.equal((html.match(/href="#estudo\/administracao\/ADM-01\/exercicios"/g)||[]).length,1);
 assert.equal((html.match(/href="#treino-admin\/banco\/ADM-01\/1"/g)||[]).length,1);
 const a=html.indexOf('Atividades do módulo'),b=html.indexOf('Aulas por subtópico');
 assert.ok(a>=0&&b>a,'Ações gerais vêm antes das aulas, após o aproveitamento.');
 assert.ok(html.indexOf('Aproveitamento do módulo')<a);
});
test('diagnóstico geral abre primeiro cartão que ainda não tem avaliação',async()=>{
 const html=await render();
 assert.match(html,/href="#estudo\/administracao\/ADM-01\/diagnostico\/2"/);
 assert.match(html,/1\/3 cartões avaliados/);
});
test('diagnóstico concluído abre cartão 1 para revisão, sem criar botão por subtópico',async()=>{
 const view=rawView();for(const k of Object.keys(view.score.subtopics))view.score.subtopics[k].diagnostic='sei';
 const html=await render(undefined,view);
 assert.match(html,/href="#estudo\/administracao\/ADM-01\/diagnostico\/1"/);
 assert.match(html,/3\/3 cartões avaliados · Rever respostas/);
 assert.equal((html.match(/diagnostico\/\d/g)||[]).length,1);
});
test('subtópicos são links integrais para aulas, sem botões Ler aula ou Diagnóstico',async()=>{
 const html=await render();
 assert.equal((html.match(/class="shared-topic-link"/g)||[]).length,3);
 assert.match(html,/href="#estudo\/administracao\/ADM-01\/aula\/1"/);
 assert.match(html,/href="#estudo\/administracao\/ADM-01\/aula\/2"/);
 assert.match(html,/href="#estudo\/administracao\/ADM-01\/aula\/3"/);
 assert.doesNotMatch(html,/>Ler aula<\/a>|data-lesson-open|data-diag-open/);
 assert.match(html,/✓ Aula concluída/);
 assert.match(html,/Aula pendente/);
});
test('ferramentas secundárias aparecem recolhidas em detalhes; versão original mantida',async()=>{
 const html=await render();
 assert.match(html,/<details class="shared-module-extra">/);
 assert.match(html,/#materia\/administracao\/legado/);
 assert.match(html,/#treino-admin\/revisao/);
 assert.match(html,/#treino-admin\/simulado/);
 assert.match(html,/#treino-admin\/estatisticas/);
});
test('aula e diagnóstico continuam acessíveis, com registro e botão de voltar',async()=>{
 const aula=await render(['estudo','administracao','ADM-01','aula','1']);
 assert.match(aula,/Aula já marcada como estudada/);
 assert.match(aula,/Voltar ao módulo/);
 assert.doesNotMatch(aula,/class="shared-module-primary-actions"/);
 const diag=await render(['estudo','administracao','ADM-01','diagnostico','2']);
 assert.match(diag,/Frente 2/);
 assert.match(diag,/Revelar resposta/);
 assert.match(diag,/Voltar ao módulo/);
});
test('layout não escreve no armazenamento e não modifica dados nem totais',async()=>{
 let writes=0;
 const original=rawBundle(),data=rawView(),copy=structuredClone([original,data]);
 const hadStorage=Object.hasOwn(globalThis,'localStorage'),oldStorage=globalThis.localStorage;
 globalThis.localStorage={getItem:()=>null,setItem:()=>writes++,removeItem:()=>writes++};
 try{await render(undefined,data,original);assert.equal(writes,0);assert.deepEqual([original,data],copy);}finally{
  if(hadStorage)globalThis.localStorage=oldStorage;else delete globalThis.localStorage;
 }
});
test('nomes de tópicos são escapados antes da inserção em atributos e rótulos',async()=>{
 const bundle=rawBundle();bundle.subtopics[0].title='Aula <script>alert(1)</script> & gestão';
 const html=await render(undefined,rawView(),bundle);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/Aula &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; gestão/);
});
test('índice segue acessível a módulos sem aula sem inventar páginas',async()=>{
 const bundle=rawBundle();delete bundle.lessons['ADM-01-002'];
 const html=await render(undefined,rawView(),bundle);
 assert.equal((html.match(/class="shared-topic-link"/g)||[]).length,2);
 assert.match(html,/Aula em preparação/);
 assert.match(html,/href="#estudo\/administracao\/ADM-01\/aula\/2"/);
});
test('CSS torna links de subtópico clicáveis com foco e layout responsivo',()=>{
 const css=readFileSync(new URL('../site/css/app.css',import.meta.url),'utf8');
 assert.match(css,/\.shared-topic-link\{/);
 assert.match(css,/\.shared-module-primary-actions\{/);
 assert.match(css,/@media \(max-width:700px\)/);
 assert.match(css,/:focus-visible/);
});
