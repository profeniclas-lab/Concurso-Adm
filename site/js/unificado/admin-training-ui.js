/** Fase 6 — telas de treino do portal. Não importam o motor legado nem seus dados. */
import {loadAdminCatalog,loadAdminQuestions} from './admin-catalog.js';
import {readTrainingState,updateTrainingState} from './training-store.js';
import {TRAINING_KEY,recordTrainingAttempt,summarizeTraining,reviewEntries,
  selectExamQuestions,createExam,answerExam,navigateExam,finishExam} from './training-engine.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
const a=(hash,label,cls='btn')=>`<a class="${cls}" href="#${esc(hash)}">${esc(label)}</a>`;
const title=(heading,subtitle='')=>`<div class="section-head"><div><p class="eyebrow">Novo motor · Fase 6</p><h1>${esc(heading)}</h1>${subtitle?`<p class="muted">${esc(subtitle)}</p>`:''}</div>${a('materia/administracao','Abrir ADM-ESTUDO')}</div>`;
const fmt=x=>x?new Date(x).toLocaleDateString('pt-BR'):'—';
const alphabet=i=>String.fromCharCode(65+i);
const retake=new Set();
let busy=false;
const errorState=r=>{if(!r.ok)throw Error(r.message||'Não foi possível carregar os dados de treino.');return r.state};
const snapshot=()=>errorState(readTrainingState());
const note='<p class="notice" role="note"><strong>Área nova de treino:</strong> as respostas aqui são salvas separadamente, na chave <code>estudoConcursos.v1.training.administracao</code>. O progresso do ADM-ESTUDO original não é alterado nem somado automaticamente. Use o backup desta área antes de trocar de navegador.</p>';
const stat=(val,label)=>`<div class="stat"><strong class="stat-value">${esc(val)}</strong><span class="stat-label">${esc(label)}</span></div>`;
const linkNav=`<nav class="training-nav" aria-label="Atividades do novo motor">${a('treino-admin','Painel')}${a('treino-admin/modulos','Banco de questões')}${a('treino-admin/simulado','Simulados')}${a('treino-admin/revisao','Revisão')}${a('treino-admin/estatisticas','Estatísticas')}</nav>`;
const answers=q=>q.options.map((option,i)=>`<button class="choice" type="button" data-train-action="bank-answer" data-qid="${esc(q.id)}" data-selected="${i}">${alphabet(i)}. ${esc(option)}</button>`).join('');
const explain=q=>`<div class="feedback"><strong>Gabarito: ${alphabet(q.answer)} — ${esc(q.options[q.answer])}</strong>${q.explanation?`<p>${esc(q.explanation)}</p>`:''}${q.examTip?`<p><strong>Dica:</strong> ${esc(q.examTip)}</p>`:''}</div>`;
function bankItem(q,index,state,{review=false}={}){
 const r=state.questions[q.id];const key=(review?'r:':'b:')+q.id;
 const show=r&&!retake.has(key);
 return `<article class="activity-card" data-train-question="${esc(q.id)}"><p class="eyebrow">Questão ${index} · ${esc(q.id)}</p><h3>${esc(q.stem)}</h3>
 ${show?`<p class="state ${r.lastCorrect?'live':''}">Última tentativa: ${r.lastCorrect?'Acerto':'Erro'} · ${r.attempts} tentativa(s)</p>${explain(q)}<button class="btn" type="button" data-train-action="retry" data-qid="${esc(q.id)}" data-review="${review?'1':'0'}">Responder novamente</button>`:
 `<div class="training-answers">${q.options.map((v,i)=>`<button class="choice" type="button" data-train-action="${review?'review-answer':'bank-answer'}" data-qid="${esc(q.id)}" data-selected="${i}">${alphabet(i)}. ${esc(v)}</button>`).join('')}</div>`}
 </article>`;
}
async function renderHome(main){
 const m=await loadAdminCatalog();const info=summarizeTraining(snapshot());
 main.innerHTML=`${title('Treino de Administração','Questões sob demanda, histórico próprio e prática modular')}${linkNav}${note}
 <section class="stats" aria-label="Resumo da nova área">${stat(m.questionCount,'Questões disponíveis')}${stat(info.distinct,'Questões já praticadas')}${stat(info.accuracy===null?'—':info.accuracy+'%','Acerto por tentativa')}${stat(info.due,'Revisões vencidas')}</section>
 <div class="training-actions"><article class="panel"><h2>Banco de questões</h2><p>Escolha um módulo e responda com correção imediata.</p>${a('treino-admin/modulos','Escolher módulo','btn btn-primary')}</article>
 <article class="panel"><h2>Simulado de 20 questões</h2><p>Treino geral ou por módulo, com retomada se você fechar a página.</p>${a('treino-admin/simulado','Abrir simulados')}</article>
 <article class="panel"><h2>Revisão de erros</h2><p>Organize novas tentativas com intervalos simples.</p>${a('treino-admin/revisao','Revisar erros')}</article></div>`;
}
async function renderModules(main){
 const m=await loadAdminCatalog();const info=summarizeTraining(snapshot());
 main.innerHTML=`${title('Banco de questões por módulo')}${linkNav}${note}
 <div class="module-list">${m.modules.map(x=>`<a class="module-item" href="#treino-admin/banco/${esc(x.id)}/1"><strong>${esc(x.id)} · ${esc(x.title)}</strong><small>${x.count} questões · ${info.modules[x.id]?.distinct??0} já respondidas</small></a>`).join('')}</div>`;
}
async function renderBank(main,id,page){
 const m=await loadAdminCatalog();const x=m.modules.find(v=>v.id===id);if(!x)throw Error('Módulo inválido.');
 const qs=await loadAdminQuestions(id);const pages=Math.ceil(qs.length/5);
 if(!Number.isInteger(page)||page<1||page>pages)throw Error('Página inválida.');
 const first=(page-1)*5;const st=snapshot();
 main.innerHTML=`${title(`${x.id} — ${x.title}`,'Banco de questões com registro de respostas')}${linkNav}${note}
 <div class="inline-actions">${a('treino-admin/modulos','← Todos os módulos')}<span class="state">${qs.length} questões · página ${page}/${pages}</span></div>
 ${qs.slice(first,first+5).map((q,i)=>bankItem(q,first+i+1,st)).join('')}
 <nav class="preview-pagination" aria-label="Páginas">${page>1?a(`treino-admin/banco/${id}/${page-1}`,'← Anterior'):''}<span>Página ${page} de ${pages}</span>${page<pages?a(`treino-admin/banco/${id}/${page+1}`,'Próxima →','btn btn-primary'):''}</nav>`;
}
async function renderExam(main){
 const state=snapshot();const manifest=await loadAdminCatalog();const sess=state.session;
 if(!sess){
  main.innerHTML=`${title('Simulado de 20 questões')}${linkNav}${note}
    <section class="panel"><h2>Criar simulado</h2><p>O simulado geral sorteia questões de até 10 módulos; somente esses módulos são carregados. Escolha um módulo específico se preferir.</p>
    <label for="exam-scope">Abrangência</label><select class="training-select" id="exam-scope"><option value="general">Geral — 20 questões de várias áreas</option>
    ${manifest.modules.filter(m=>m.count>=20).map(m=>`<option value="${esc(m.id)}">${esc(m.id)} — ${esc(m.title)}</option>`).join('')}</select>
    <button class="btn btn-primary" type="button" data-train-action="exam-start">Começar simulado</button></section>
    ${state.simulations.length?`<h2 class="section-title">Simulados anteriores</h2><ol class="training-results">${state.simulations.slice(0,8).map(s=>`<li>${fmt(s.finishedAt)} · ${s.scope==='general'?'Geral':esc(s.moduleId)} · ${s.correct}/${s.total} (${s.score}%)</li>`).join('')}</ol>`:''}`;
  return;
 }
 const id=sess.ids[sess.cursor],moduleId=sess.moduleIds[id];
 const questions=await loadAdminQuestions(moduleId);const q=questions.find(q=>q.id===id);if(!q)throw Error('Questão do simulado não encontrada. O histórico foi preservado.');
 const selected=sess.answers[id];const responded=Object.keys(sess.answers).length;
 main.innerHTML=`${title('Simulado em andamento')}${linkNav}
 <div class="notice"><strong>${responded}/${sess.ids.length}</strong> questões respondidas. O simulado é salvo a cada escolha. Respostas podem ser alteradas antes da finalização.</div>
 <article class="activity-card"><p class="eyebrow">Questão ${sess.cursor+1} de ${sess.ids.length} · ${esc(moduleId)}</p><h3>${esc(q.stem)}</h3>
 ${q.options.map((v,i)=>`<button class="choice ${selected===i?'training-selected':''}" type="button" data-train-action="exam-answer" data-selected="${i}" data-qid="${esc(q.id)}" aria-pressed="${selected===i?'true':'false'}">${alphabet(i)}. ${esc(v)}</button>`).join('')}
 </article><div class="preview-pagination"><button class="btn" data-train-action="exam-prev" ${sess.cursor===0?'disabled':''}>← Anterior</button><button class="btn" data-train-action="exam-next" ${sess.cursor===sess.ids.length-1?'disabled':''}>Próxima →</button></div>
 ${responded===sess.ids.length?`<button class="btn btn-primary" data-train-action="exam-finish">Finalizar e corrigir o simulado</button>`:`<p class="small muted">A correção aparece somente após responder às ${sess.ids.length} questões.</p>`}<p><button class="btn" data-train-action="exam-cancel">Cancelar este simulado</button></p>`;
}
async function renderReview(main,all=false,page=1){
 const st=snapshot(),stats=summarizeTraining(st);const entries=reviewEntries(st,{dueOnly:!all});const pages=Math.max(1,Math.ceil(entries.length/5));const currentPage=Math.min(pages,Math.max(1,page));const visible=entries.slice((currentPage-1)*5,currentPage*5);
 const modules=[...new Set(visible.map(x=>x.moduleId))];const arrays=await Promise.all(modules.map(id=>loadAdminQuestions(id)));const lookup=new Map(arrays.flat().map(q=>[q.id,q]));
 const found=visible.map(item=>({entry:item,q:lookup.get(item.id)}));
 if(found.some(x=>!x.q))throw Error('Uma questão do histórico não está no catálogo atual. Os dados foram preservados.');
 main.innerHTML=`${title('Revisão das questões erradas')}${linkNav}${note}
 <div class="stats">${stat(stats.wrongQuestions,'Questões com erro anterior')}${stat(stats.due,'Revisões vencidas')}</div>
 <div class="inline-actions">${a('treino-admin/revisao','Vencidas')}${a('treino-admin/revisao/todas','Todos os erros')}</div>
 ${found.length?found.map((x,i)=>bankItem(x.q,i+1,st,{review:true})).join(''):'<div class="panel"><p>Nenhuma questão nesta lista. Os erros receberão novas datas de revisão após cada tentativa.</p></div>'}
 ${entries.length>5?`<nav class="preview-pagination" aria-label="Páginas de revisão">${currentPage>1?a(`treino-admin/revisao/${all?'todas':'vencidas'}/${currentPage-1}`,'← Anterior'):''}<span>Página ${currentPage} de ${pages}</span>${currentPage<pages?a(`treino-admin/revisao/${all?'todas':'vencidas'}/${currentPage+1}`,'Próxima →'):''}</nav>`:''}`;
}
function renderStats(main){
 const st=snapshot(),tot=summarizeTraining(st);
 main.innerHTML=`${title('Estatísticas da nova área')}${linkNav}${note}
 <div class="stats">${stat(tot.distinct,'Questões distintas')}${stat(tot.attempts,'Tentativas registradas')}${stat(tot.accuracy===null?'—':`${tot.accuracy}%`,'Taxa de acerto')}${stat(tot.simulations,'Simulados concluídos')}</div>
 <h2>Atividade por módulo</h2><div class="module-list">${Object.entries(tot.modules).sort(([a],[b])=>a.localeCompare(b)).map(([id,m])=>`<div class="module-item"><strong>${esc(id)}</strong><small>${m.distinct} questões · ${m.attempts} tentativas · ${m.attempts?Math.round(m.correct*100/m.attempts):0}% de acerto · ${m.due} revisões vencidas</small></div>`).join('')||'<p>Nenhuma questão respondida nesta área ainda.</p>'}</div>
 <div class="panel"><h2>Exportação manual</h2><p>Baixe uma cópia do histórico desta nova área. A importação e a sincronização com outros dispositivos ainda não estão disponíveis; não limpe este navegador até essas funções serem implementadas.</p><button class="btn btn-primary" type="button" data-train-action="export">Exportar cópia do histórico</button></div>`;
}
export async function renderAdminTraining(route,main,isCurrent=()=>true){
 if(!isCurrent())return;
 // Captura a referência original antes de usar um adaptador com setter.
 // Sem isso, a atribuição "main=safeMain" redireciona o setter para si mesmo.
 const targetMain=main;
 const safeMain={set innerHTML(value){if(isCurrent())targetMain.innerHTML=value;}};
 main=safeMain;
 if(route.length===1)return renderHome(main);
 if(route[1]==='modulos' && route.length===2)return renderModules(main);
 if(route[1]==='banco'&&route.length===4)return renderBank(main,route[2],Number(route[3]));
 if(route[1]==='simulado' && route.length===2)return renderExam(main);
 if(route[1]==='revisao' && route.length>=2 && route.length<=4 && (!route[2]||['todas','vencidas'].includes(route[2]))){const page=route[3]?Number(route[3]):1;if(!Number.isInteger(page)||page<1)throw Error('Página inválida.');return renderReview(main,route[2]==='todas',page);}
 if(route[1]==='estatisticas' && route.length===2)return renderStats(main);
 throw Error('Página de treinamento desconhecida.');
}
function update(fn){const r=updateTrainingState(fn);if(!r.ok)throw Error(r.message);return r.result;}
async function examQuestionObjects(sess){
 const moduleIds=[...new Set(Object.values(sess.moduleIds))];const groups=await Promise.all(moduleIds.map(id=>loadAdminQuestions(id)));
 const map=new Map(groups.flat().map(q=>[q.id,q]));
 const questions=sess.ids.map(id=>map.get(id));if(questions.some(q=>!q))throw Error('Faltam questões do simulado. Os dados não foram alterados.');return questions;
}
export async function handleAdminTrainingClick(event,rerender){
 const btn=event.target.closest('button[data-train-action]');if(!btn)return false;
 if(busy)return true;busy=true;btn.disabled=true;
 try{
  const route=decodeURIComponent(location.hash.slice(1)).split('/');if(route[0]!=='treino-admin')return true;
  const op=btn.dataset.trainAction;
  if(op==='export'){
    const st=snapshot();const blob=new Blob([JSON.stringify({format:'estudo-concursos-training-backup/v1',createdAt:new Date().toISOString(),state:st},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`estudo-concursos-treino-adm-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);return true;
  }
  if(op==='retry') {retake.add((btn.dataset.review==='1'?'r:':'b:')+btn.dataset.qid);await rerender();return true;}
  if(op==='bank-answer'||op==='review-answer') {
    let q;
    if(op==='bank-answer'){
      if(route[1]!=='banco')throw Error('Abra o banco de questões antes de responder.');
      q=(await loadAdminQuestions(route[2])).find(x=>x.id===btn.dataset.qid);
    }else {
      const current=snapshot().questions[btn.dataset.qid];if(!current)throw Error('Questão não registrada para revisão.');
      q=(await loadAdminQuestions(current.moduleId)).find(x=>x.id===btn.dataset.qid);
    }
    if(!q)throw Error('Questão não encontrada.');
    const selected=Number(btn.dataset.selected);
    update(state=>recordTrainingAttempt(state,q,selected,{source:op==='bank-answer'?'bank':'review'}));
    retake.delete((op==='bank-answer'?'b:':'r:')+q.id);
    await rerender();return true;
  }
  if(op==='exam-start'){
    const manifest=await loadAdminCatalog();const selected=document.getElementById('exam-scope')?.value??'general';
    const scope=selected==='general'?'general':'module';
    const questions=await selectExamQuestions(manifest,loadAdminQuestions,{scope,moduleId:scope==='module'?selected:null,count:20});
    update(state=>createExam(state,questions,{scope,moduleId:scope==='module'?selected:null}));
    await rerender();return true;
  }
  if(['exam-answer','exam-prev','exam-next','exam-finish','exam-cancel'].includes(op)){ 
    const sess=snapshot().session;if(!sess)throw Error('Nenhum simulado em andamento.');
    if(op==='exam-cancel'){if(!window.confirm('Cancelar o simulado em andamento? As respostas ainda não serão adicionadas às estatísticas.'))return true;update(state=>{state.session=null});await rerender();return true;}
    if(op==='exam-answer'){
      const id=sess.ids[sess.cursor];if(id!==btn.dataset.qid)throw Error('Questão fora da posição atual.');
      const q=(await loadAdminQuestions(sess.moduleIds[id])).find(x=>x.id===id);
      update(state=>answerExam(state,id,Number(btn.dataset.selected),[q]));
    }else if(op==='exam-prev'||op==='exam-next')update(state=>navigateExam(state,op==='exam-prev'?-1:1));
    else {
      const questions=await examQuestionObjects(sess);
      const result=update(state=>finishExam(state,questions));
      window.alert(`Simulado finalizado. Resultado: ${result.correct} de ${result.total} (${result.score}%). O histórico foi salvo somente na nova área de treino.`);
    }
    await rerender();return true;
  }
  throw Error('Ação de treino não reconhecida.');
 }catch(error){window.alert('Não foi possível concluir: '+String(error.message||error));return true;}
 finally{busy=false;btn.disabled=false;}
}
