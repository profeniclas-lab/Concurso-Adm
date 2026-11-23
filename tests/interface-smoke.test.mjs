import test from 'node:test';
import assert from 'node:assert/strict';

const listeners={};
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{id,innerHTML:'',textContent:'',attrs:{},dataset:{},
  classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this.attrs[k]=v},removeAttribute(k){delete this.attrs[k]},
  addEventListener(type,fn){listeners[`el:${id}:${type}`]=fn},});return elements.get(id)}
const store=new Map();
globalThis.document={documentElement:{dataset:{}},getElementById:el,addEventListener:(n,f)=>{listeners[n]=f}};
globalThis.window={addEventListener:(n,f)=>{listeners[`window:${n}`]=f}};
globalThis.location={hash:''};
globalThis.localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
globalThis.fetch=async()=>({ok:false,headers:{get:()=> 'text/html'}});
// O módulo de interface será carregado após preparar os objetos globais.
await import('../site/js/unificado/app.js');
const tick=()=>new Promise(resolve=>setTimeout(resolve,12));

test('interface inicializa sem DOM completo e apresenta as 5 matérias',async()=>{
  await tick();const html=el('content').innerHTML;
  assert.match(html,/Um lugar para todas as matérias/);
  assert.match(html,/Português e Redação Oficial/);
  assert.match(html,/Direito Constitucional/);
  assert.equal((html.match(/class="subject-card"/g)||[]).length,5);
});
test('rotas dos catálogos vazios funcionam sem inventar aulas',async()=>{
  globalThis.location.hash='#materia/portugues';await listeners['window:hashchange']();await tick();
  assert.match(el('content').innerHTML,/Módulos publicados/);
  assert.match(el('content').innerHTML,/ainda não foram publicados/);
  assert.doesNotMatch(el('content').innerHTML,/Não foi possível abrir esta página/);
});
test('Administração oferece ponte de acesso quando a cópia não está embutida',async()=>{
  globalThis.location.hash='#materia/administracao';await listeners['window:hashchange']();await tick();
  const html=el('content').innerHTML;
  assert.match(html,/Abrir ADM-ESTUDO original/);
  assert.match(html,/Dir-Adm/);
  assert.equal(store.has('admEstudo.v2.state'),false);
});
test('alteração do tema usa apenas o namespace do portal',async()=>{
  listeners['el:theme-toggle:click']();
  assert.equal(globalThis.document.documentElement.dataset.theme,'dark');
  assert.match(store.get('estudoConcursos.v1.ui'),/"dark"/);
  assert.equal(store.has('admEstudo.v2.state'),false);
});
