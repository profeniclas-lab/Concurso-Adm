import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
const extract=(html,kind)=>[...html.matchAll(kind==='css'?/<link\s+[^>]*href="([^"]+\.css)"/g:/<script\s+[^>]*src="([^"]+\.js)"/g)].map(x=>x[1]);

test('a raiz do repositório abre o portal ESTUDO-CONCURSOS, não o ADM-ESTUDO antigo',()=>{
 const html=read('index.html');
 assert.match(html,/<title>ESTUDO-CONCURSOS/);
 assert.match(html,/id="content"/);
 assert.doesNotMatch(html,/src="app.js"/);
 assert.doesNotMatch(html,/src="config.js"/);
});

test('o index.html da raiz aponta para CSS e JS já presentes no pacote',()=>{
 const html=read('index.html');
 assert.deepEqual(extract(html,'css'),['./site/css/app.css']);
 assert.deepEqual(extract(html,'js'),['./site/js/unificado/app.js']);
 for(const path of [...extract(html,'css'),...extract(html,'js')]) assert.ok(existsSync(join(root,path)),`Arquivo não encontrado: ${path}`);
});

test('o index.html do build GitHub Actions preserva os caminhos relativos a dist/',()=>{
 const html=read('site/index.html');
 assert.deepEqual(extract(html,'css'),['./css/app.css']);
 assert.deepEqual(extract(html,'js'),['./js/unificado/app.js']);
 for(const path of [...extract(html,'css'),...extract(html,'js')]) assert.ok(existsSync(join(root,'site',path)),`Arquivo não encontrado: ${path}`);
});
