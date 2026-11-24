import {listSubjects,getSubject} from './subjects.js';
import {loadAdminCatalog,loadAdminQuestions} from './admin-catalog.js';
import {renderAdminTraining,handleAdminTrainingClick} from './admin-training-ui.js';
import {renderSharedModule,handleSharedModuleClick} from './shared-module-ui.js';
import {getSubjectStorageKey,UNIFIED_UI_STORAGE_KEY} from './storage-keys.js';
import {loadSubjectCatalog,loadModule} from './loader.js';
import {readSubjectProgress,readAdminProgress,saveSubjectProgress,summarizeSubjectProgress,recordQuestion,recordDiagnostic,markLessonComplete,recordFlashcard} from './progress-store.js';

const main=document.getElementById('content');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
const subjects=listSubjects();
let sequence=0;
const revealed=new Set();
const retake=new Set();
let currentBundle=null;
let currentCatalog=null;
let activeRoute=null;
let saveError='';
const link=(route)=>'#'+route;

function safeHash(){const fragment=decodeURIComponent(location.hash.slice(1)||'inicio');return fragment.split('/').filter(Boolean)}
function setNav(route){for(const id of ['inicio','disciplinas']){const el=document.getElementById('nav-'+id);if(el){if(id===route)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current')}}}
function crumb(items){return `<nav class="breadcrumb" aria-label="Caminho">${items.map((x,i)=>i===items.length-1?`<span aria-current="page">${esc(x.text)}</span>`:`<a href="${esc(link(x.href))}">${esc(x.text)}</a><span aria-hidden="true"> / </span>`).join('')}</nav>`}
const subjectCard=subject=>`<article class="subject-card">
  <div class="subject-top"><span class="subject-icon" aria-hidden="true">${subject.icon}</span><span class="state ${subject.id==='administracao'?'live':''}">${subject.id==='administracao'?'CONTEÚDO DISPONÍVEL':'ESTRUTURA PRONTA'}</span></div>
  <h3>${esc(subject.title)}</h3><p>${esc(subject.description)}</p>
  <a class="btn ${subject.id==='administracao'?'btn-primary':''}" href="#materia/${esc(subject.id)}">${subject.id==='administracao'?'Abrir matéria':'Ver matéria'} <span aria-hidden="true">→</span></a>
</article>`;
function readSummary(subject){
  if(subject.id==='administracao'){
    const r=readAdminProgress();
    return r.ok&&r.exists?summarizeSubjectProgress(r.state):{lessons:0,questions:0,errorCount:0,diagnostics:0};
  }
  const r=readSubjectProgress(subject.id);
  return r.ok?summarizeSubjectProgress(r.state):{lessons:0,questions:0,errorCount:0,diagnostics:0};
}
function renderHome(){
 const summaries=subjects.map(readSummary);const lessons=summaries.reduce((n,x)=>n+x.lessons,0);const questions=summaries.reduce((n,x)=>n+x.questions,0);
 main.innerHTML=`<section class="hero"><p class="eyebrow">Seu espaço de preparação</p><h1>Um lugar para todas as matérias do seu concurso.</h1><p>Organize a preparação, mantenha cada disciplina independente e avance no seu ritmo. Administração já possui um ambiente completo de estudo.</p></section>
 <div class="stats" aria-label="Atividade registrada neste navegador"><div class="stat"><strong class="stat-value">${subjects.length}</strong><span class="stat-label">Disciplinas cadastradas</span></div>
 <div class="stat"><strong class="stat-value">${lessons}</strong><span class="stat-label">Aulas concluídas no histórico anterior</span></div><div class="stat"><strong class="stat-value">${questions}</strong><span class="stat-label">Questões distintas do histórico anterior</span></div></div>
 <div class="section-head"><h2>Escolha sua disciplina</h2><span class="muted small">Cada matéria terá módulos e progresso próprios.</span></div>
 <div class="grid">${subjects.map(subjectCard).join('')}</div>
 <p class="small muted">Os totais acima são indicadores dos históricos anteriores disponíveis neste navegador, não uma soma com as atividades do motor compartilhado. Para conferir o aproveitamento atualizado de Administração, abra a disciplina e escolha “Meu aproveitamento atualizado”. Não há sincronização automática entre dispositivos.</p>`;
}
function renderSubjects(){main.innerHTML=`${crumb([{text:'Início',href:'inicio'},{text:'Disciplinas'}])}<div class="section-head"><h2>Todas as disciplinas</h2></div><div class="grid">${subjects.map(subjectCard).join('')}</div>`}
async function isAdminBundled(){try{const res=await fetch(new URL('./administracao/index.html',location.href),{method:'HEAD',cache:'no-store'});return res.ok && (res.headers.get('content-type')??'').includes('text/html')}catch{return false}}
async function renderAdminLegacy(subject,token){
  const local=await isAdminBundled();if(token!==sequence)return;
  main.classList.toggle('workspace',local);
  main.innerHTML=`${crumb([{text:'Início',href:'inicio'},{text:subject.shortTitle}])}
    <div class="section-head"><div><p class="eyebrow">Matéria disponível</p><h2>${esc(subject.title)}</h2></div><a class="btn" href="#inicio">← Voltar ao painel</a></div>
    ${local?`<p class="notice">Integração de transição: o ADM-ESTUDO original está incorporado abaixo, sem alterações nas suas aulas, questões ou regras de progresso.</p>
    <div class="inline-actions"><a class="btn" href="#admin-modulos">Consultar 757 questões</a><a class="btn btn-primary" href="#treino-admin">Treinar no novo motor</a><a class="btn" href="./administracao/index.html" target="_blank" rel="noopener noreferrer">Abrir Administração em tela cheia ↗</a></div>
    <iframe id="admin-frame" class="admin-frame" title="Aplicativo ADM-ESTUDO — Administração e Direito Administrativo" src="./administracao/index.html" loading="eager" referrerpolicy="same-origin"></iframe>`:
    `<div class="panel"><h3>Administração já está disponível</h3><p>Esta cópia de teste não inclui os arquivos administrativos. Na publicação pelo GitHub Actions, a versão preservada de <code>Dir-Adm/nova-arquitetura</code> será incorporada automaticamente.</p>
    <p>Enquanto isso, você pode estudar no aplicativo original:</p><a class="btn btn-primary" href="https://profeniclas-lab.github.io/Dir-Adm/" target="_blank" rel="noopener noreferrer">Abrir ADM-ESTUDO original ↗</a></div>`}`;
}
/** Fase 8D: motor comum é a entrada principal; a versão antiga permanece
 * acessível SOMENTE por uma rota explícita, sem apagar arquivos nem histórico.
 */
async function renderAdminNative(subject,token){
 const bundled=await isAdminBundled();if(token!==sequence)return;
 if(!bundled){
  main.classList.remove('workspace');
  main.innerHTML=`${crumb([{text:'Início',href:'inicio'},{text:subject.shortTitle}])}
  <section class="panel"><h2>Administração — catálogo ainda não incorporado</h2>
  <p>O build rápido não inclui o pacote administrativo. A publicação via GitHub Actions o inclui.</p>
  <a class="btn btn-primary" href="https://profeniclas-lab.github.io/Dir-Adm/" target="_blank" rel="noopener noreferrer">Abrir ADM-ESTUDO original</a></section>`;
  return;
 }
 const catalog=await loadAdminCatalog();if(token!==sequence)return;
 main.classList.remove('workspace');
 main.innerHTML=`${crumb([{text:'Início',href:'inicio'},{text:subject.shortTitle}])}
 <section class="hero"><p class="eyebrow">Motor compartilhado · Fase 8D</p>
 <h1>${esc(subject.title)}</h1><p>Estude aulas e diagnósticos, pratique exercícios e acompanhe questões, revisões e simulados no portal unificado.</p></section>
 <section class="stats" aria-label="Catálogo administrativo">
 <div class="stat"><strong class="stat-value">${catalog.moduleCount}</strong><span class="stat-label">Módulos</span></div>
 <div class="stat"><strong class="stat-value">${catalog.questionCount}</strong><span class="stat-label">Questões preservadas</span></div></section>
 <div class="inline-actions"><a class="btn btn-primary" href="#treino-admin/visao-unificada/1">Meu aproveitamento atualizado</a>
 <a class="btn" href="#treino-admin">Banco, revisão e simulados</a>
 <a class="btn" href="#treino-admin/auditoria">Backup e segurança</a>
 <a class="btn" href="#materia/administracao/legado">Abrir ADM-ESTUDO original (alternativa)</a></div>
 <p class="notice" role="note">Transição gradual: o ADM-ESTUDO antigo permanece preservado e pode ser aberto a qualquer momento. As novas atividades não alteram o histórico original. Quando não for possível reconciliar a nota do Banco, ela ficará preservada.</p>
 <div class="module-list">${catalog.modules.map(m=>`<article class="module-item"><strong>${esc(m.id)} · ${esc(m.title)}</strong>
 <small>${m.count} questões</small><div class="inline-actions">
 <a class="btn btn-primary" href="#estudo/administracao/${esc(m.id)}">Estudar módulo</a>
 <a class="btn" href="#treino-admin/banco/${esc(m.id)}/1">Banco de questões</a></div></article>`).join('')}</div>`;
}
/** Visão leve de consulta: não grava respostas nem altera aproveitamento. */
async function renderAdminModules(token){
 const data=await loadAdminCatalog();if(token!==sequence)return;
 main.innerHTML=`${crumb([{text:'Início',href:'inicio'},{text:'Administração',href:'materia/administracao'},{text:'Questões por módulo'}])}
 <section class="hero"><p class="eyebrow">Consulta rápida</p><h1>Questões de Administração por módulo</h1><p>Escolha um módulo para consultar as questões sem gravar. Para registrar estudo e acompanhar aproveitamento, utilize o motor compartilhado.</p></section>
 <div class="stats"><div class="stat"><strong class="stat-value">${data.moduleCount}</strong><span class="stat-label">Módulos</span></div>
 <div class="stat"><strong class="stat-value">${data.questionCount}</strong><span class="stat-label">Questões distintas</span></div>
 <div class="stat"><strong class="stat-value">Sob demanda</strong><span class="stat-label">Carrega só o módulo escolhido</span></div></div>
 <div class="section-head"><h2>Escolha o módulo</h2><div class="inline-actions"><a class="btn btn-primary" href="#treino-admin">Novo motor com registro de respostas</a><a class="btn" href="#materia/administracao">Voltar à Administração</a></div></div>
 <div class="module-list">${data.modules.map(item=>`<a class="module-item" href="#admin-questoes/${esc(item.id)}/1"><strong>${esc(item.id)} · ${esc(item.title)}</strong><small>${item.count} questões</small></a>`).join('')}</div>`;
}
async function renderAdminQuestionPreview(moduleId,page,token){
 const data=await loadAdminCatalog();if(token!==sequence)return;
 const module=data.modules.find(m=>m.id===moduleId);if(!module)throw Error('Módulo desconhecido.');
 const questions=await loadAdminQuestions(moduleId);if(token!==sequence)return;
 const pageSize=6, pages=Math.ceil(questions.length/pageSize);
 if(!Number.isSafeInteger(page)||page<1||page>pages)throw Error('Página inválida.');
 const first=(page-1)*pageSize;
 const visible=questions.slice(first,first+pageSize);
 main.innerHTML=`${crumb([{text:'Início',href:'inicio'},{text:'Administração',href:'materia/administracao'},{text:'Módulos',href:'admin-modulos'},{text:module.title}])}
 <div class="section-head"><div><p class="eyebrow">${esc(module.id)} · Consulta por módulo</p><h2>${esc(module.title)}</h2></div><a class="btn" href="#admin-modulos">← Todos os módulos</a></div>
 <p class="notice">Consulta de leitura: os gabaritos ficam ocultos até você abrir cada explicação. <strong>Nenhuma resposta é registrada aqui.</strong> Para registrar respostas e usar revisão espaçada, abra o Banco no motor compartilhado.</p>
 <div class="inline-actions"><span class="state">${module.count} questões</span><a class="btn" href="#materia/administracao">Abrir ADM-ESTUDO completo</a></div>
 <div class="admin-preview">${visible.map((q,i)=>`<article class="activity-card"><p class="eyebrow">Questão ${first+i+1} de ${questions.length} · ${esc(q.id)}</p><h3>${esc(q.stem)}</h3>
 <ol class="preview-options" type="A">${q.options.map(option=>`<li>${esc(option)}</li>`).join('')}</ol>
 <details class="preview-answer"><summary>Ver gabarito e comentário</summary><p><strong>Gabarito:</strong> ${String.fromCharCode(65+q.answer)} — ${esc(q.options[q.answer])}</p>
 ${q.explanation?`<p>${esc(q.explanation)}</p>`:''}${q.examTip?`<p><strong>Dica:</strong> ${esc(q.examTip)}</p>`:''}</details></article>`).join('')}</div>
 <nav class="preview-pagination" aria-label="Páginas de questões"><span>Página ${page} de ${pages}</span>
 ${page>1?`<a class="btn" href="#admin-questoes/${esc(moduleId)}/${page-1}">← Anterior</a>`:''}
 ${page<pages?`<a class="btn btn-primary" href="#admin-questoes/${esc(moduleId)}/${page+1}">Próximas →</a>`:''}</nav>`;
}
async function renderSubject(subject,token){
 if(subject.id==='administracao')return renderAdminNative(subject,token);
 const data=await loadSubjectCatalog(subject.id);if(token!==sequence)return;currentCatalog=data;
 const summary=readSummary(subject);
 main.innerHTML=`${crumb([{text:'Início',href:'inicio'},{text:subject.shortTitle}])}<section class="hero"><p class="eyebrow">Disciplina</p><h1>${esc(subject.title)}</h1><p>Conteúdo distribuído em arquivos individuais por módulo, com progresso salvo separadamente.</p></section>
 <div class="stats"><div class="stat"><strong class="stat-value">${data.modules.length}</strong><span class="stat-label">Módulos publicados</span></div>
 <div class="stat"><strong class="stat-value">${summary.lessons}</strong><span class="stat-label">Aulas concluídas</span></div><div class="stat"><strong class="stat-value">${summary.questions}</strong><span class="stat-label">Questões distintas respondidas</span></div></div>
 <div class="section-head"><h2>Módulos</h2><button class="btn" type="button" data-export="${esc(subject.id)}">Exportar progresso</button></div>
 ${data.modules.length?`<div class="module-list">${data.modules.map(m=>`<a class="module-item" href="#modulo/${esc(subject.id)}/${esc(m.id)}/aulas"><strong>${esc(m.id)} · ${esc(m.title)}</strong><small>${m.subtopics.length} subtópicos</small></a>`).join('')}</div>`:
 `<div class="panel"><h3>Estrutura pronta para receber conteúdos</h3><p>Os módulos desta matéria ainda não foram publicados. Não criamos aulas ou questões artificiais apenas para preencher a interface.</p><p class="small muted">No próximo lote, cada módulo terá sua própria pasta com aulas, diagnóstico, exercícios, questões e flashcards.</p></div>`}`;
}
function loadSaved(subjectId){const result=readSubjectProgress(subjectId);if(!result.ok)throw new Error(result.message);return result}
function storeChanged(subjectId,change){const loaded=loadSaved(subjectId);const updated=change(loaded.state);const saved=saveSubjectProgress(subjectId,loaded.raw,updated);if(!saved.ok)throw new Error(saved.message);}
const tabs=[['diagnostico','Diagnóstico'],['aulas','Aulas'],['exercicios','Exercícios'],['banco','Banco de questões'],['flashcards','Flashcards']];
function renderLessonBody(lesson){const fields=[['Conceito',lesson.concept],['Explicação',lesson.explanation],['Exemplo',lesson.example],['Dica de prova',lesson.examTip],['Resumo',lesson.summary]];return fields.filter(x=>x[1]).map(([title,body])=>`<h4>${esc(title)}</h4><p>${esc(body)}</p>`).join('')}
function renderDiagnostic(bundle,state){const list=bundle.diagnostic;if(!list.length)return emptyActivity('diagnóstico');return list.map((item,i)=>{
 const id=item.subtopicId??`${bundle.moduleId}-D${i}`;const rating=state.progress.diagnostics[id]?.rating;return `<article class="activity-card"><p class="eyebrow">Cartão ${i+1}</p><h3>${esc(item.front)}</h3>
 ${revealed.has('d:'+id)?`<p>${esc(item.back)}</p><div class="inline-actions">${[['sei','Eu sabia'],['duvida','Tive dúvida'],['nao','Não sabia']].map(([v,t])=>`<button class="btn" type="button" data-diagnostic="${esc(id)}" data-rating="${v}">${t}</button>`).join('')}</div>`:
 `<button type="button" class="btn" data-reveal="d:${esc(id)}">Revelar resposta</button>`}
 ${rating?`<p class="small muted">Última autoavaliação: ${esc({sei:'Eu sabia',duvida:'Tive dúvida',nao:'Não sabia'}[rating])}</p>`:''}</article>`}).join('');}
function renderLessons(bundle,module,state){const lessons=bundle.lessons;const names=new Map((module?.subtopics??[]).map(t=>[t.id,t.title]));const all=Object.entries(lessons);if(!all.length)return emptyActivity('aulas');return all.map(([id,lesson],i)=>`<article class="activity-card"><p class="eyebrow">Aula ${i+1}</p><h3>${esc(names.get(id)??lesson.title??id)}</h3>${renderLessonBody(lesson)}
 <div class="inline-actions">${state.progress.lessons[id]?.completed?`<span class="state live">Aula concluída</span>`:`<button type="button" class="btn btn-primary" data-complete="${esc(id)}">Marcar como concluída</button>`}</div></article>`).join('');}
function renderQuestions(bundle,state,mode){const data=mode==='exercicios'?bundle.exercises:bundle.questions;if(!data.length)return emptyActivity(mode==='exercicios'?'exercícios':'questões');const bucket=mode==='exercicios'?'exercises':'questionHistory';return data.map((q,i)=>{
 const record=state.progress[bucket][q.id],key=bucket+':'+q.id,already=!!record&&!retake.has(key);
 return `<article class="activity-card"><p class="eyebrow">${mode==='exercicios'?'Exercício':'Questão'} ${i+1} · ${esc(q.id)}</p><h3>${esc(q.stem)}</h3>
 ${q.options.map((option,j)=>`<button class="choice" type="button" data-answer="${esc(q.id)}" data-kind="${mode}" data-index="${j}" ${already?'disabled':''}>${String.fromCharCode(65+j)}. ${esc(option)}</button>`).join('')}
 ${already?`<div class="feedback ${record.lastCorrect?'':'incorrect'}"><strong>${record.lastCorrect?'Resposta correta.':'Resposta incorreta.'}</strong><p>Gabarito: ${String.fromCharCode(65+q.answer)}. ${esc(q.options[q.answer])}</p>${q.explanation?`<p>${esc(q.explanation)}</p>`:''}<button type="button" class="btn" data-retake="${esc(key)}">Responder novamente</button></div>`:''}
 </article>`}).join('');}
function renderFlashcards(bundle,state){const list=bundle.flashcards;if(!list.length)return emptyActivity('flashcards');return list.map((item,i)=>{
 const id=item.id??`${bundle.moduleId}-F${i}`,rating=state.progress.flashcards[id]?.rating;
 return `<article class="activity-card"><p class="eyebrow">Flashcard ${i+1}</p><h3>${esc(item.front)}</h3>${revealed.has('f:'+id)?`<p>${esc(item.back)}</p><div class="inline-actions">${[['sei','Eu sabia'],['duvida','Tive dúvida'],['nao','Não sabia']].map(([v,t])=>`<button class="btn" data-flash="${esc(id)}" data-rating="${v}">${t}</button>`).join('')}</div>`:`<button class="btn" data-reveal="f:${esc(id)}">Revelar resposta</button>`}${rating?`<p class="small muted">Última avaliação: ${esc(rating)}</p>`:''}</article>`}).join('');}
function emptyActivity(name){return `<div class="panel"><p>Não há ${esc(name)} cadastrados neste módulo ainda.</p></div>`}
async function renderModule(subject,moduleId,mode,token){
 const {modules}=await loadSubjectCatalog(subject.id);if(token!==sequence)return;const module=modules.find(x=>x.id===moduleId);if(!module)throw Error('Módulo não cadastrado.');
 const bundle=await loadModule(subject.id,moduleId);if(token!==sequence)return;currentBundle=bundle;
 const {state}=loadSaved(subject.id);
 const content=mode==='diagnostico'?renderDiagnostic(bundle,state):mode==='aulas'?renderLessons(bundle,module,state):mode==='exercicios'||mode==='banco'?renderQuestions(bundle,state,mode):renderFlashcards(bundle,state);
 main.innerHTML=`${crumb([{text:'Início',href:'inicio'},{text:subject.shortTitle,href:'materia/'+subject.id},{text:module.title}])}
 <div class="section-head"><div><p class="eyebrow">${esc(module.id)}</p><h2>${esc(module.title)}</h2></div><a class="btn" href="#materia/${esc(subject.id)}">← Voltar aos módulos</a></div>
 <div class="activity-nav" role="group" aria-label="Atividades do módulo">${tabs.map(([key,label])=>`<a class="btn" aria-current="${mode===key?'page':'false'}" href="#modulo/${esc(subject.id)}/${esc(moduleId)}/${key}">${esc(label)}</a>`).join('')}</div>
 ${saveError?`<div class="notice error" role="alert">${esc(saveError)}</div>`:''}${content}`;
}
function applyAction(subjectId,fn){try{storeChanged(subjectId,fn);saveError='';return true}catch(error){saveError=String(error.message||error);return false}}
async function handleClick(event){const btn=event.target.closest('button[data-reveal],button[data-retake],button[data-answer],button[data-diagnostic],button[data-complete],button[data-flash],button[data-export]');if(!btn)return;
 const route=safeHash();
 if(btn.dataset.export){const id=btn.dataset.export;const found=readSubjectProgress(id);if(!found.ok){alert(found.message);return}const blob=new Blob([JSON.stringify({format:'estudo-concursos-subject-backup',subjectId:id,createdAt:new Date().toISOString(),state:found.state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`estudo-concursos-${id}-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);return}
 if(route[0]!=='modulo')return;const [_,subjectId,moduleId,mode='aulas']=route;if(!getSubject(subjectId)||!currentBundle||currentBundle.moduleId!==moduleId)return;
 if(btn.dataset.reveal){revealed.add(btn.dataset.reveal);await render();return}
 if(btn.dataset.retake){retake.add(btn.dataset.retake);await render();return}
 const bundle=currentBundle;
 if(btn.dataset.complete){const id=btn.dataset.complete;if(!Object.hasOwn(bundle.lessons,id))return;applyAction(subjectId,s=>markLessonComplete(s,id));await render();return}
 if(btn.dataset.diagnostic){const id=btn.dataset.diagnostic;if(!bundle.diagnostic.some(x=>x.subtopicId===id))return;applyAction(subjectId,s=>recordDiagnostic(s,id,btn.dataset.rating));await render();return}
 if(btn.dataset.flash){const id=btn.dataset.flash;if(!bundle.flashcards.some((x,i)=>(x.id??`${bundle.moduleId}-F${i}`)===id))return;applyAction(subjectId,s=>recordFlashcard(s,id,btn.dataset.rating));await render();return}
 if(btn.dataset.answer){const q=[...(mode==='exercicios'?bundle.exercises:bundle.questions)].find(x=>x.id===btn.dataset.answer);if(!q)return;const i=Number(btn.dataset.index);const kind=mode==='exercicios'?'exercicios':'banco';if(!Number.isInteger(i))return;const success=applyAction(subjectId,s=>recordQuestion(s,q,i,kind));if(success)retake.delete((kind==='exercicios'?'exercises':'questionHistory')+':'+q.id);await render();}
}
async function render(){const token=++sequence;currentBundle=null;main.classList.remove('workspace');const route=safeHash();activeRoute=route;setNav(route[0]);main.innerHTML='<div class="loading">Carregando…</div>';try{
 if(route[0]==='inicio'||route.length===0){renderHome();return}
 if(route[0]==='disciplinas'){renderSubjects();return}
 if(route[0]==='materia'&&route[1]==='administracao'&&route[2]==='legado'&&route.length===3){await renderAdminLegacy(getSubject('administracao'),token);return}
 if(route[0]==='materia'&&route.length===2){const subject=getSubject(route[1]);if(!subject)throw Error('Disciplina não encontrada.');await renderSubject(subject,token);return}
 if(route[0]==='admin-modulos'&&route.length===1){await renderAdminModules(token);return}
   if(route[0]==='estudo'){await renderSharedModule(route,main,()=>token===sequence);return}
 if(route[0]==='treino-admin'){await renderAdminTraining(route,main,()=>token===sequence);return}
 if(route[0]==='admin-questoes'&&route.length>=2&&route.length<=3){await renderAdminQuestionPreview(route[1],Number(route[2]??1),token);return}
 if(route[0]==='modulo'&&route.length>=3){const subject=getSubject(route[1]);if(!subject||subject.id==='administracao'||!tabs.some(t=>t[0]===(route[3]??'aulas')))throw Error('Página do módulo inválida.');await renderModule(subject,route[2],route[3]??'aulas',token);return}
 location.hash='#inicio';
 }catch(error){if(token!==sequence)return;main.innerHTML=`<section class="panel"><h2>Não foi possível abrir esta página</h2><p class="notice error">${esc(error.message||error)}</p><a class="btn" href="#inicio">Voltar ao início</a></section>`}}
function setupTheme(){let theme='light';try{theme=JSON.parse(localStorage.getItem(UNIFIED_UI_STORAGE_KEY)??'{}').theme==='dark'?'dark':'light'}catch{}document.documentElement.dataset.theme=theme;const btn=document.getElementById('theme-toggle');const sync=()=>{btn.textContent=theme==='dark'?'☀':'☾';btn.setAttribute('aria-label',theme==='dark'?'Ativar modo claro':'Ativar modo escuro')};sync();btn.addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;sync();try{localStorage.setItem(UNIFIED_UI_STORAGE_KEY,JSON.stringify({theme}))}catch{}})}
setupTheme();window.addEventListener('hashchange',()=>render());document.addEventListener('click',async event=>{
 if(event.target instanceof Element && event.target.closest('button[data-train-action]'))await handleAdminTrainingClick(event,render);
 else if(event.target instanceof Element && event.target.closest('button[data-shared-action],button[data-shared-exercise]'))await handleSharedModuleClick(event,render);
 else await handleClick(event);
});render();
