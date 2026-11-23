/**
 * Testes de publicação — apenas integridade técnica.
 * NÃO examinam gabaritos, enunciados nem outros conteúdos pedagógicos.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFileSync(join(root,p),'utf8');
const SHA='3790500f772aad3f8c263b68e8e2dfd8bab7c465';
const essential=['index.html','js/app.js','js/start-f25-lote04.js','js/data/questions.js','js/data/modules.js','js/core/storage.js'];

test('workflow publica dist/ e permite executar manualmente',()=>{
  const flow=read('.github/workflows/pages.yml');
  assert.match(flow,/workflow_dispatch:/);
  assert.match(flow,/branches:\s*\[main\]/);
  assert.match(flow,/npm test/);
  assert.match(flow,/npm run build/);
  assert.match(flow,/actions\/upload-pages-artifact@v3/);
  assert.match(flow,/actions\/deploy-pages@v4/);
  assert.match(flow,/pages: write/);
  assert.match(flow,/id-token: write/);
});

test('entrada do portal montado não usa index antigo da raiz',()=>{
  const script=read('scripts/build-site.sh');
  assert.match(script,/cp -a site\/\. dist\//);
  assert.match(script,/grep -q 'ESTUDO-CONCURSOS' dist\/index\.html/);
  assert.match(script,/ADMIN_SHA='3790500f772aad3f8c263b68e8e2dfd8bab7c465'/);
  assert.match(script,/diff -qr/);
  assert.doesNotMatch(read('site/js/unificado/app.js'),/localStorage\.setItem\(['"]admEstudo\.v2\.state/);
});

test('tela de Administração oferece iframe e alternativa em tela cheia',()=>{
  const app=read('site/js/unificado/app.js');
  assert.match(app,/iframe id="admin-frame"/);
  assert.match(app,/Abrir Administração em tela cheia/);
  assert.match(app,/\.\/administracao\/index\.html/);
});

const zipAvailable=process.platform!=='win32'&&spawnSync('zip',['-v'],{stdio:'ignore'}).status===0;
test('build com pacote administrativo simulado copia arquivos sem alterações',
 {skip:!zipAvailable},()=>{
  const temp=mkdtempSync(join(tmpdir(),'estudo-deploy-test-'));
  const tree=join(temp,`Dir-Adm-${SHA}`);
  const archive=join(temp,'admin-simulado.zip');
  const expected=new Map();
  try{
    for(const f of essential){
      const path=join(tree,f);mkdirSync(dirname(path),{recursive:true});
      const content=f==='index.html'?'<!doctype html><title>ADM-ESTUDO</title>\n':`// arquivo simulado ${f}\n`;
      expected.set(f,content);writeFileSync(path,content);
    }
    writeFileSync(join(tree,'style.css'),'/* Arquivo simulado */\n');
    const archived=spawnSync('zip',['-qr',archive,`Dir-Adm-${SHA}`],{cwd:temp,encoding:'utf8'});
    assert.equal(archived.status,0,archived.stderr);
    const run=spawnSync('bash',['scripts/build-site.sh'],{
      cwd:root,encoding:'utf8',env:{...process.env,ESTUDO_ADMIN_ARCHIVE:archive}
    });
    assert.equal(run.status,0,run.stderr||run.stdout);
    assert.match(read('dist/index.html'),/ESTUDO-CONCURSOS/);
    for(const [f,content] of expected) assert.equal(read(`dist/administracao/${f}`),content,f);
    assert.match(read('dist/administracao/FONTE-INTEGRACAO.txt'),new RegExp(SHA));
    assert.ok(existsSync(join(root,'dist','.nojekyll')));
    assert.ok(!existsSync(join(root,'dist','content','questions.js')),
      'Não copiar arquivos legados da raiz do repositório no portal publicado.');
  } finally {rmSync(join(root,'dist'),{recursive:true,force:true});rmSync(temp,{recursive:true,force:true})}
});
