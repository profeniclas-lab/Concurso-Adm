import test from 'node:test';
import assert from 'node:assert/strict';
const callbacks={},els=new Map(),writes=[];
const node=id=>{if(!els.has(id))els.set(id,{id,innerHTML:'',textContent:'',dataset:{},
 classList:{toggle(){},remove(){},add(){}},setAttribute(){},removeAttribute(){},
 addEventListener:(e,fn)=>callbacks[`el:${id}:${e}`]=fn});return els.get(id);};
const ids=Array.from({length:27},(_,i)=>i<9?`ADM-${String(i+1).padStart(2,'0')}`:
 i<17?`AP-${String(i+1).padStart(2,'0')}`:`DA-${String(i+1).padStart(2,'0')}`);
const manifest={format:'estudo-concursos/admin-lazy-catalog/v1',moduleCount:27,questionCount:757,
 modules:ids.map((id,i)=>({id,title:'Módulo '+id,count:i===0?29:28,file:`questoes/${id}.js`}))};
// 29+26*28=757
const storage=new Map();
globalThis.document={documentElement:{dataset:{}},getElementById:node,
 addEventListener:(e,fn)=>callbacks[`doc:${e}`]=fn};
globalThis.window={addEventListener:(e,fn)=>callbacks[`win:${e}`]=fn};
globalThis.location={hash:'#materia/administracao',href:'https://example.test/Concurso-Adm/'};
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>{writes.push(k);storage.set(k,v)}};
globalThis.fetch=async url=>{
 const u=String(url);
 if(u.endsWith('/administracao/index.html'))return {ok:true,headers:{get:()=> 'text/html'}};
 if(u.endsWith('/catalogo-leve/manifest.json'))return {ok:true,json:async()=>manifest};
 return {ok:false,headers:{get:()=>''}};
};
await import('../site/js/unificado/app.js');
const tick=()=>new Promise(r=>setTimeout(r,20));
test('rota principal abre os 27 módulos nativos, sem abrir iframe',async()=>{
 await tick();const html=node('content').innerHTML;
 assert.match(html,/Motor compartilhado · Fase 8D/);
 assert.match(html,/Meu aproveitamento atualizado/);
 assert.equal((html.match(/Estudar módulo/g)||[]).length,27);
 assert.doesNotMatch(html,/<iframe/);
 assert.deepEqual(writes,[]);
});
test('a rota explícita legado preserva o iframe e permite voltar ao motor comum',async()=>{
 location.hash='#materia/administracao/legado';await callbacks['win:hashchange']();await tick();
 assert.match(node('content').innerHTML,/<iframe id="admin-frame"/);
 location.hash='#materia/administracao';await callbacks['win:hashchange']();await tick();
 assert.doesNotMatch(node('content').innerHTML,/<iframe/);
 assert.equal(writes.includes('admEstudo.v2.state'),false);
});
