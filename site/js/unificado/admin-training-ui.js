/** Fase 6 — telas de treino do portal. Não importam o motor legado nem seus dados. */
import {loadAdminCatalog,loadAdminQuestions} from './admin-catalog.js';
import {readTrainingState,updateTrainingState} from './training-store.js';
import {readLegacyState,compareHistories,buildDualHistorySnapshot} from './legacy-compat.js';
import {prepareLegacyMigration,commitLegacyMigration,inspectMigrationRecovery,restorePreMigration,discardUnappliedRecovery} from './legacy-migration.js';
import {loadPedagogyIndex,allModulePedagogy,preparePedagogyImport,commitPedagogyImport,
  readPedagogySnapshot,inspectPedagogyRecovery,restorePedagogyImport,buildPedagogyBackup} from './admin-pedagogy.js';
import {buildAdminModuleProgress,ratingLabel} from './admin-module-progress.js';
import {auditPhase7E,buildPhase7EBackup,readRecoveryForAudit} from './phase7e-audit.js';
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
const note='<p class="notice" role="note"><strong>Área nova de treino:</strong> salva em <code>estudoConcursos.v1.training.administracao</code>. A importação de tentativas antigas é opcional, em Históricos. O ADM-ESTUDO original não é alterado. Faça backups antes de trocar de navegador.</p>';
const stat=(val,label)=>`<div class="stat"><strong class="stat-value">${esc(val)}</strong><span class="stat-label">${esc(label)}</span></div>`;
const linkNav=`<nav class="training-nav" aria-label="Atividades do novo motor">${a('treino-admin','Painel')}${a('treino-admin/modulos','Módulos e questões')}${a('treino-admin/simulado','Simulados')}${a('treino-admin/revisao','Revisão')}${a('treino-admin/estatisticas','Estatísticas')}${a('treino-admin/compatibilidade','Históricos')}${a('treino-admin/pedagogia','Aproveitamento')}${a('treino-admin/auditoria','Verificação 7E')}</nav>`;
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
 <article class="panel"><h2>Revisão de erros</h2><p>Organize novas tentativas com intervalos simples.</p>${a('treino-admin/revisao','Revisar erros')}</article>
 <article class="panel"><h2>Progresso por módulo</h2><p>Consulte o aproveitamento importado e a atividade nova, sem somar as duas notas.</p>${a('treino-admin/modulos','Ver meus módulos')}</article></div>`;
}
/**
 * Fase 7D: resumo por módulo a partir da cópia F7C ou do histórico original.
 * Nunca escreve e nunca mistura pontos importados com tentativas do treino.
 */
async function moduleOverview(){
 const index=await loadPedagogyIndex();
 const legacy=readLegacyState(),saved=readPedagogySnapshot();
 const warnings=[];
 if(!legacy.ok)warnings.push('O histórico do ADM-ESTUDO está incompatível: '+legacy.message+'; dados preservados.');
 if(!saved.ok)warnings.push('A cópia pedagógica importada não pôde ser lida: '+saved.message+'; dados preservados.');
 const overview=buildAdminModuleProgress(index,snapshot(),{
   legacy:legacy.ok&&legacy.exists?legacy.state:null,
   imported:saved.ok&&saved.exists?saved.snapshot:null
 });
 return {overview,warnings};
}
const points=n=>Number(n).toFixed(2).replace('.',',');
const sourceText=x=>x==='imported'?'cópia pedagógica da Fase 7C':x==='legacy'?'ADM-ESTUDO original (somente leitura)':'nenhum histórico pedagógico disponível';
const scoreText=x=>x.hasData?`${points(x.earnedWeightedPoints)} de 100 pontos (nota parcial ${x.percentage}%)`:'Sem pontuação registrada';
const components=[['diagnostic','Diagnóstico'],['lessonCompletion','Aulas concluídas'],['lessonSelfAssessment','Autoavaliação das aulas'],['exercises','Exercícios de aprendizagem'],['bank','Banco de questões original']];
const warningHtml=items=>items.map(x=>`<p class="notice error" role="alert">${esc(x)}</p>`).join('');
async function renderModules(main){
 const {overview,warnings}=await moduleOverview();
 main.innerHTML=`${title('Módulos: progresso e questões','27 módulos · atividade pedagógica e treino mostrados separadamente')}${linkNav}${note}
 ${warningHtml(warnings)}
 <p class="notice" role="note"><strong>Origem do aproveitamento:</strong> ${esc(sourceText(overview.source))}. A nota pedagógica de 75 pontos <strong>não incorpora</strong> as novas tentativas, e questões iguais não são somadas duas vezes. ${overview.sourceMayBeOlder?'O ADM-ESTUDO original pode ter sido atualizado após a importação.':''}</p>
 <section class="stats" aria-label="Progresso por módulo">${stat(overview.rows.length,'Módulos disponíveis')}${stat(overview.started,'Módulos com aproveitamento registrado')}${stat(overview.atGoal,'Módulos com meta de 75 pontos')}</section>
 <div class="module-list">${overview.rows.map(x=>`<article class="module-item module-progress-row">
 <div class="module-progress-heading"><div><h2>${esc(x.id)} · ${esc(x.title)}</h2><p class="small muted">${x.questionsAvailable} questões cadastradas</p></div><span class="state ${x.completed?'live':''}">${x.completed?'75 pontos atingidos':x.hasData?'Em andamento':'Sem registro'}</span></div>
 <p><strong>Pedagógico:</strong> ${esc(scoreText(x))}</p>
 <p class="small muted"><strong>Novo treino:</strong> ${x.training.distinct} questões distintas, ${x.training.attempts} tentativas e ${x.training.due} revisão(ões) vencida(s) — estatísticas independentes.</p>
 <div class="inline-actions">${a(`treino-admin/modulo/${x.id}`,'Ver progresso e atividades')}${a(`estudo/administracao/${x.id}`,'Estudar aulas e diagnóstico')}${a(`treino-admin/banco/${x.id}/1`,'Responder questões','btn btn-primary')}</div></article>`).join('')}</div>`;
}
async function renderAdminModuleDetails(main,moduleId){
 const {overview,warnings}=await moduleOverview();
 const x=overview.rows.find(m=>m.id===moduleId);
 if(!x)throw Error('Módulo administrativo não encontrado no catálogo validado.');
 const status=x.completed?'Meta de 75 pontos atingida':x.hasData?'Meta ainda não atingida':'Aproveitamento ainda não registrado';
 main.innerHTML=`${title(`${x.id} — ${x.title}`,'Progresso pedagógico por módulo · Fase 7D')}${linkNav}${warningHtml(warnings)}
 <div class="inline-actions">${a('treino-admin/modulos','← Todos os módulos')}${a(`estudo/administracao/${x.id}`,'Abrir aulas no motor comum')}${a(`treino-admin/banco/${x.id}/1`,'Treinar questões','btn btn-primary')}${a('treino-admin/pedagogia','Gerenciar importação pedagógica')}</div>
 <p class="notice" role="note"><strong>Fonte da pontuação:</strong> ${esc(sourceText(x.source))}${x.sourceAt?' · referência '+esc(fmt(x.sourceAt)):''}. ${x.source==='imported'?'Esta é uma fotografia do momento da importação; novas atividades não alteram esta nota.':''}${x.sourceMayBeOlder?' O registro original pode ter atividades posteriores.':''}</p>
 <section class="panel"><h2>Aproveitamento pedagógico</h2>
 <p class="module-score">${x.hasData?`${points(x.earnedWeightedPoints)} <span>de 100 pontos · ${x.percentage}%</span>`:'— <span>sem atividade pedagógica registrada</span>'}</p>
 <progress class="module-progress-meter" max="100" value="${x.hasData?x.earnedWeightedPoints:0}" aria-label="Pontos de aproveitamento pedagógico de ${esc(x.id)}"></progress>
 <p><span class="state ${x.completed?'live':''}">${esc(status)}</span> ${x.hasData?`· Cobertura avaliada: ${points(x.coveragePercentage)}%`:''}</p>
 <h3>Composição da nota original</h3>
 <div class="module-component-list">${components.map(([key,label])=>{const c=x.components[key];return `<div class="module-component"><span>${esc(label)} <small class="muted">(peso ${c.weight})</small></span><strong>${points(c.points)} / ${c.weight}</strong></div>`}).join('')}</div>
 <p class="small muted">A pontuação mantém a regra 20 + 15 + 15 + 30 + 20. O indicador de 75 pontos não é uma média das questões respondidas no motor novo.</p></section>
 <section class="panel"><h2>Diagnóstico e aulas por subtópico</h2>
 <div class="module-subtopics">${x.subtopics.map(t=>`<div class="module-subtopic"><strong>${esc(t.title)}</strong><small class="muted">${esc(t.id)}</small>
 <p>Diagnóstico: ${esc(t.hasDiagnostic?ratingLabel(t.diagnostic):'Indisponível')} · Aula: ${esc(t.hasLesson?(t.lessonCompleted?'Concluída':'Não concluída'):'Indisponível')} · Autoavaliação: ${esc(t.hasLesson?ratingLabel(t.lessonRating):'Indisponível')}</p></div>`).join('')}</div>
 <p class="small muted">As informações exibidas pertencem à fonte pedagógica indicada acima. A conclusão ou autoavaliação não é deduzida de tentativas de questões.</p></section>
 <section class="panel"><h2>Exercícios de aprendizagem</h2><p>${x.exerciseSession?`${x.exerciseSession.answered} respostas registradas em ${x.exerciseSession.total} questões da sessão · ${x.exerciseSession.finished?'sessão concluída':'sessão ainda não concluída'}`:'Nenhuma sessão de exercícios importada ou identificada.'}</p></section>
 <section class="panel"><h2>Questões no novo motor — histórico independente</h2>
 <div class="stats">${stat(x.training.distinct,'Questões distintas respondidas')}${stat(x.training.attempts,'Tentativas registradas')}${stat(x.training.accuracy===null?'—':x.training.accuracy+'%','Acerto por tentativa')}${stat(x.training.due,'Revisões vencidas')}</div>
 <p>${x.training.withErrors} questão(ões) com erro registrado neste motor. <strong>Esses resultados não alteram automaticamente os pontos pedagógicos acima.</strong></p>
 ${a(`treino-admin/banco/${x.id}/1`,'Responder questões deste módulo','btn btn-primary')}</section>`;
}
async function renderBank(main,id,page){
 const m=await loadAdminCatalog();const x=m.modules.find(v=>v.id===id);if(!x)throw Error('Módulo inválido.');
 const qs=await loadAdminQuestions(id);const pages=Math.ceil(qs.length/5);
 if(!Number.isInteger(page)||page<1||page>pages)throw Error('Página inválida.');
 const first=(page-1)*5;const st=snapshot();
 main.innerHTML=`${title(`${x.id} — ${x.title}`,'Banco de questões com registro de respostas')}${linkNav}${note}
 <div class="inline-actions">${a('treino-admin/modulos','← Todos os módulos')}${a(`treino-admin/modulo/${id}`,'Ver meu progresso')}<span class="state">${qs.length} questões · página ${page}/${pages}</span></div>
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
 <div class="panel"><h2>Exportação manual</h2><p>Baixe uma cópia do histórico desta nova área. A importação controlada de tentativas antigas está em Históricos; restauração por arquivo e sincronização entre dispositivos ainda não estão disponíveis. Não limpe os dados do navegador.</p><button class="btn btn-primary" type="button" data-train-action="export">Exportar cópia do histórico</button></div>`;
}
let pendingLegacyImport=null;
let manualBackupInitiated=false;
function migrationPanel(hasLegacy){
 const recovery=inspectMigrationRecovery();
 if(recovery.exists){
  return `<section class="panel"><h2>Recuperação da importação</h2>
   <p>Existe uma cópia automática do histórico novo anterior à última importação. ${recovery.importedQuestions??0} questões estavam nessa operação.</p>
   ${recovery.canRestore?`<p class="notice">É possível desfazer essa importação enquanto não houver estudo novo registrado desde então.</p>
   <button type="button" class="btn" data-train-action="migration-restore">Desfazer importação e restaurar histórico novo</button>`:
   recovery.canDiscardUnapplied?`<p class="notice">A importação foi interrompida antes de alterar o histórico novo. A cópia técnica pendente pode ser liberada com segurança.</p>
   <button type="button" class="btn" data-train-action="migration-discard">Liberar cópia não aplicada</button>`:
   `<p class="notice">A recuperação automática está bloqueada porque o histórico mudou depois da importação, ou a cópia está incompatível. Seu histórico atual não será sobrescrito.</p>`}</section>`;
 }
 if(!hasLegacy)return `<section class="panel"><h2>Migração opcional</h2><p>O histórico original não foi encontrado neste navegador. Não há o que importar.</p></section>`;
 const d=pendingLegacyImport?.counts;
 return `<section class="panel"><h2>Fase 7B — Migração controlada de tentativas</h2>
 <p>Esta opção é <strong>manual</strong>. Apenas tentativas detalhadas e verificáveis, ainda ausentes do novo motor, serão importadas. Não transfere aproveitamento ponderado, aulas, flashcards, simulados antigos ou datas de revisão.</p>
 <p>O catálogo de 757 questões será conferido nesta prévia. Nenhum progresso será modificado ao preparar.</p>
 <div class="inline-actions"><button type="button" class="btn" data-train-action="migration-preview">Preparar prévia sem gravar</button></div>
 ${d?`<div class="notice" role="status"><strong>Prévia de importação</strong><p>Importáveis: <strong>${d.importedQuestions}</strong> questões, <strong>${d.importedAttempts}</strong> tentativas detalhadas.</p>
 <p>Já no novo motor: ${d.alreadyInNew}; somente resumo antigo: ${d.summaryOnly}; não localizadas no catálogo: ${d.notInCatalog}; revisões editoriais: ${d.editorialRevisions}; incompatíveis: ${d.incompatible}; apenas fontes não equivalentes: ${d.unsupportedOnly}; importações parciais: ${d.partial}.</p>
 <p>Questões com partes não verificáveis continuarão disponíveis no histórico antigo. Revisões serão reagendadas somente quando você responder novamente no motor novo.</p>
 <p>${manualBackupInitiated?'O download de backup foi solicitado nesta sessão; confirme que o arquivo foi realmente salvo e conferido.':'Baixe primeiro a cópia dos dois históricos e confira que o arquivo foi salvo.'}</p>
 <button type="button" class="btn btn-primary" data-train-action="migration-commit" ${!manualBackupInitiated||!d.importedQuestions?'disabled':''}>Confirmar importação de ${d.importedQuestions} questões</button></div>`:''}
 </section>`;
}
function renderCompatibility(main) {
 const old=readLegacyState();
 const modern=snapshot();
 if(!old.ok){
  main.innerHTML=`${title('Compatibilidade dos históricos')}${linkNav}<div class="notice error" role="alert">O histórico do ADM-ESTUDO não pôde ser interpretado: ${esc(old.message)}. Nenhuma gravação ou migração foi feita.</div><p>Faça um backup pelo aplicativo original antes de qualquer tentativa de migração. Você também pode exportar as cópias brutas, mesmo quando o arquivo antigo não puder ser lido:</p><button class="btn btn-primary" type="button" data-train-action="dual-export">Exportar cópia dos dois históricos</button>${migrationPanel(false)}`;
  return;
 }
 const report=compareHistories(old.state,modern);
 const left=report.legacy;
 const missing='<span class="muted">Não encontrado neste navegador</span>';
 main.innerHTML=`${title('Compatibilidade dos históricos','Comparação e opção de importar tentativas verificáveis com sua autorização')}${linkNav}
 <p class="notice" role="note"><strong>Somente leitura (comparação):</strong> os registros continuam independentes. A importação opcional exige prévia, backup e confirmação; a contagem compartilhada considera IDs, sem duplicações.</p>
 <section class="stats" aria-label="Questões distintas em ambos os aplicativos">
 ${stat(report.distinctUnion,'Questões distintas nos dois históricos')}
 ${stat(report.oldOnly,'Apenas no ADM-ESTUDO')}
 ${stat(report.newOnly,'Apenas no novo motor')}
 ${stat(report.overlap,'Presentes nos dois históricos')}</section>
 <div class="training-actions">
 <article class="panel"><h2>ADM-ESTUDO original</h2>${left?
 `<p><strong>${left.distinct}</strong> questões distintas respondidas.</p><p>${left.trackedAttempts} tentativas com registro explícito · ${left.lessons} aulas concluídas · ${left.diagnosticModules} módulos com diagnóstico.</p><p>${left.simulations} simulados concluídos · ${left.due} revisões de questões vencidas, dentre ${left.scheduledReviews} agendadas.</p>`:missing}</article>
 <article class="panel"><h2>Novo motor</h2><p><strong>${report.modern.distinct}</strong> questões distintas respondidas.</p><p>${report.modern.attempts} tentativas registradas · ${report.modern.simulations} simulados concluídos.</p><p>${report.modern.due} revisões vencidas, dentre ${report.modern.scheduledReviews} questões agendadas para revisão.</p></article></div>
 <section class="panel"><h2>Proteção antes da migração</h2><p>Exporte uma cópia bruta dos dois históricos disponíveis neste navegador. O arquivo contém os registros originais e não é restaurado automaticamente. Guarde-o em local seguro.</p>
 <button class="btn btn-primary" type="button" data-train-action="dual-export">Exportar cópia dos dois históricos</button></section>
 ${migrationPanel(old.exists)}
 <section class="panel"><h2>O que ainda não está unificado</h2><ul>${report.limitations.map(v=>`<li>${esc(v)}</li>`).join('')}</ul><p>Se você estudou em outro navegador ou aparelho, os dados antigos podem não estar presentes aqui. Este painel não os procura automaticamente no Google Drive.</p></section>`;
}


/** Fase 7C: espelho fiel do aproveitamento legado, sem escrita automática. */
let pendingPedagogy=null;
let pedagogyBackupRequested=false;
async function renderPedagogy(main){
 const index=await loadPedagogyIndex();
 const legacy=readLegacyState();
 const saved=readPedagogySnapshot();
 const recovery=inspectPedagogyRecovery();
 const imported=saved.ok&&saved.exists?saved.snapshot:null;
 const results=legacy.ok&&legacy.exists?allModulePedagogy(legacy.state,index):[];
 const started=results.filter(x=>x.hasData);
 const reached=results.filter(x=>x.completed);
 const noLegacy=!legacy.ok?`<p class="notice error">O histórico antigo não pôde ser interpretado: ${esc(legacy.message)}. Nenhuma gravação foi feita.</p>`:
   !legacy.exists?'<p class="notice">Não há histórico do ADM-ESTUDO neste navegador. Você pode consultar o aplicativo antigo em outro dispositivo, mas o portal não sincroniza automaticamente.</p>':'';
 const c=pendingPedagogy?.plan?.counts;
 const recoveryPanel=recovery.exists?`<div class="panel"><h2>Recuperação da cópia pedagógica</h2><p>A recuperação é independente da importação de tentativas da Fase 7B.</p>
 ${recovery.canRestore||recovery.canDiscard?`<button class="btn" type="button" data-train-action="pedagogy-restore">${recovery.canRestore?'Desfazer importação pedagógica':'Liberar cópia não aplicada'}</button>`:
 '<p class="notice">Os dados não correspondem à cópia automática. Recuperação bloqueada para não sobrescrever estudos posteriores.</p>'}</div>`:'';
 main.innerHTML=`${title('Aproveitamento e progresso pedagógico','Fase 7C · Espelho do ADM-ESTUDO e migração opcional')}${linkNav}
 <p class="notice"><strong>Regra original:</strong> diagnóstico 20%; aulas 30% (15% conclusão + 15% autoavaliação); exercícios 30%; Banco 20%. A meta é <strong>75 pontos conquistados</strong> entre 100 possíveis, mesmo com etapas pendentes. As notas abaixo são do ADM-ESTUDO original, não incluem atividades feitas no novo treino.</p>
 ${noLegacy}
 ${legacy.ok&&legacy.exists?`<div class="stats">${stat(started.length,'Módulos com atividade')}${stat(reached.length,'Módulos com 75 pontos ou mais')}${stat(index.moduleCount,'Módulos disponíveis')}${stat(index.questionCount,'Questões no catálogo')}</div>
 <section class="panel"><h2>Aproveitamento parcial por módulo</h2><p>A nota é derivada ao abrir esta página; não modifica o progresso e não esconde módulos automaticamente.</p>
 <div class="module-list">${results.map(x=>`<div class="module-item"><strong>${esc(x.moduleId)} · ${esc(x.moduleTitle)}</strong>
 <small>Nota parcial: ${x.hasData?x.percentage+'%':'—'} · Pontos: ${x.earnedWeightedPoints.toFixed(2).replace('.',',')}/100 · Cobertura avaliada: ${x.coveragePercentage.toFixed(2).replace('.',',')}% · ${x.completed?'Meta de 75 atingida':'Meta ainda não atingida'}</small></div>`).join('')}</div></section>`:''}
 <section class="panel"><h2>Importação opcional de aulas, diagnósticos e exercícios</h2>
 <p>Importa uma cópia das evidências compatíveis para <code>estudoConcursos.v1.pedagogy.administracao</code>. Os registros do ADM-ESTUDO original <strong>não são modificados</strong>. O aproveitamento importado é uma fotografia da data da importação e não se soma à nota do treino novo.</p>
 ${imported?`<p class="notice">Já existe uma cópia pedagógica importada em ${esc(imported.metadata?.importedAt??'data não informada')}. ${esc(imported.counts?.modulesWithActivity??0)} módulos com atividade no momento da importação. Ela não será sobrescrita automaticamente.</p>`:
 `<button type="button" class="btn" data-train-action="pedagogy-preview" ${!legacy.ok||!legacy.exists||recovery.exists?'disabled':''}>Preparar prévia sem gravar</button>`}
 ${c&&!imported?`<div class="notice" role="status"><strong>Prévia:</strong> ${c.modulesWithActivity} módulos com atividade; ${c.diagnosticAnswers} respostas diagnósticas; ${c.lessonsCompleted} aulas concluídas; ${c.lessonRatings} autoavaliações; ${c.exerciseAnswers} respostas de exercícios de ${c.exerciseModules} módulos.
 <p>Ignorados por incompatibilidade: ${c.skippedExerciseModules} sessões de exercícios. Respostas e notas antigas de banco continuam em seus históricos originais.</p>
 <p>${pedagogyBackupRequested?'Backup solicitado neste navegador: confirme que o arquivo foi salvo e conferido.':'Baixe e confira o backup antes de confirmar.'}</p>
 <button type="button" class="btn btn-primary" data-train-action="pedagogy-import" ${!c.importedItems||!pedagogyBackupRequested?'disabled':''}>Confirmar importação pedagógica</button></div>`:''}
 <p><button type="button" class="btn" data-train-action="pedagogy-export">Exportar backup dos históricos e da cópia pedagógica</button></p></section>
 ${recoveryPanel}
 <p class="small muted">Registros antigos sem alternativas identificáveis, questões removidas e demais atividades não equivalentes permanecem disponíveis no ADM-ESTUDO original. O progresso pedagógico importado ainda não é editável pelo novo motor.</p>`;
}

/** Fase 7E: conferência de leitura. Nenhuma alteração no armazenamento. */
async function renderAudit(main){
 const index=await loadPedagogyIndex();
 const original=readLegacyState(),saved=readPedagogySnapshot();
 const modern=readTrainingState();
 let training=modern.state;
 if(!modern.ok){
   try{training=JSON.parse(localStorage.getItem(TRAINING_KEY));}
   catch{training=null;}
 }
 const rec=readRecoveryForAudit();
 const report=auditPhase7E({index,training,
   legacy:original.ok&&original.exists?original.state:null,
   imported:saved.ok&&saved.exists?saved.snapshot:null,...rec});
 const extra=[
   !original.ok?'O histórico original não pôde ser lido: '+original.message:null,
   !saved.ok?'A cópia pedagógica não pôde ser lida: '+saved.message:null,
   !modern.ok?'O histórico do treino não pôde ser lido: '+modern.message:null
 ].filter(Boolean);
 const status={ok:'Conferido',aviso:'Atenção',erro:'Incompatível',info:'Informação'};
 main.innerHTML=`${title('Verificação da migração','Fase 7E · Auditoria somente de leitura')}${linkNav}
 <p class="notice" role="note">Esta verificação não altera dados, não mescla notas nem confirma uma restauração. Ela analisa as versões disponíveis <strong>neste navegador</strong>. A comparação independente com o motor original é executada no GitHub Actions.</p>
 ${warningHtml(extra)}
 <section class="stats" aria-label="Resultado da auditoria">${stat(report.totals.ok,'Verificações corretas')}${stat(report.totals.aviso,'Alertas')}${stat(report.totals.erro+extra.length,'Incompatibilidades')}${stat(report.statistics.distinctUnion??'—','Questões distintas entre históricos')}</section>
 <section class="panel"><h2>Conferências técnicas</h2><ul class="audit-checks">${report.checks.map(item=>`<li><strong>${esc(status[item.status])} — ${esc(item.id)}:</strong> ${esc(item.detail)}</li>`).join('')}</ul></section>
 <section class="panel"><h2>Backup completo de proteção</h2>
 <p>Inclui os registros brutos do ADM-ESTUDO, do treino novo, da cópia pedagógica, <strong>das duas recuperações técnicas</strong> e das atividades nativas da Fase 8B. O arquivo JSON é sensível e não deve ser enviado ao repositório. Não existe restauração automática a partir dele nesta fase.</p>
 <button class="btn btn-primary" type="button" data-train-action="audit-export">Exportar todos os registros</button></section>
 <section class="panel"><h2>Conferência manual de encerramento</h2>
 <ol><li>Compare em dois ou três módulos a pontuação com o ADM-ESTUDO original, sobretudo com atividades parciais.</li>
 <li>Confirme a meta de <strong>75 pontos</strong>, sem somar o treino novo à nota herdada.</li>
 <li>Confira simulados, erros e revisões nos dois motores, que ainda permanecem independentes.</li>
 <li>Teste um módulo sem estudo e outro com estudo concluído; confira se o progresso antigo permanece intacto.</li>
 <li>Verifique a publicação de <code>administracao/catalogo-leve/auditoria-fase7e.json</code> com 648 comparações e zero divergências.</li></ol>
 <p>Se houver alertas, dados inconsistentes ou diferença no aplicativo original, <strong>não considere a migração encerrada</strong> até resolver a divergência. Não limpe o armazenamento do navegador.</p></section>`;
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
 if(route[1]==='modulo' && route.length===3)return renderAdminModuleDetails(main,route[2]);
 if(route[1]==='banco'&&route.length===4)return renderBank(main,route[2],Number(route[3]));
 if(route[1]==='simulado' && route.length===2)return renderExam(main);
 if(route[1]==='revisao' && route.length>=2 && route.length<=4 && (!route[2]||['todas','vencidas'].includes(route[2]))){const page=route[3]?Number(route[3]):1;if(!Number.isInteger(page)||page<1)throw Error('Página inválida.');return renderReview(main,route[2]==='todas',page);}
 if(route[1]==='estatisticas' && route.length===2)return renderStats(main);
 if(route[1]==='compatibilidade' && route.length===2)return renderCompatibility(main);
 if(route[1]==='pedagogia' && route.length===2)return renderPedagogy(main);
 if(route[1]==='auditoria' && route.length===2)return renderAudit(main);
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
  if(op==='audit-export'){
    if(route[1]!=='auditoria')throw Error('Abra Verificação 7E para exportar este backup.');
    const payload=buildPhase7EBackup();
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const link=document.createElement('a');
    link.href=url;link.download=`estudo-concursos-backup-completo-fase7e-${new Date().toISOString().slice(0,10)}.json`;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);return true;
  }
  if(op==='pedagogy-preview'){
    if(route[1]!=='pedagogia')throw Error('Abra Aproveitamento para preparar a prévia.');
    pendingPedagogy=preparePedagogyImport(await loadPedagogyIndex());
    pedagogyBackupRequested=false;
    await rerender();return true;
  }
  if(op==='pedagogy-export'){
    if(route[1]!=='pedagogia')throw Error('Backup pedagógico disponível em Aproveitamento.');
    const payload=buildPedagogyBackup();
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=`estudo-concursos-pedagogia-${new Date().toISOString().slice(0,10)}.json`;
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
    pedagogyBackupRequested=true;await rerender();return true;
  }
  if(op==='pedagogy-import'){
    if(route[1]!=='pedagogia'||!pendingPedagogy||!pedagogyBackupRequested)
      throw Error('Prepare a prévia e faça o backup antes de importar.');
    if(!window.confirm('Você salvou e abriu o backup JSON no seu dispositivo? Se não, cancele.'))return true;
    if(!window.confirm('Importar cópia de aulas, diagnósticos e exercícios para o registro pedagógico do portal? O histórico antigo não será alterado.'))return true;
    const result=commitPedagogyImport(pendingPedagogy,{backupConfirmed:true});
    if(!result.ok)throw Error(result.message);
    pendingPedagogy=null;pedagogyBackupRequested=false;
    window.alert('Cópia pedagógica importada. Seu histórico original permanece preservado.');
    await rerender();return true;
  }
  if(op==='pedagogy-restore'){
    if(route[1]!=='pedagogia')throw Error('Abra Aproveitamento para recuperar.');
    if(!window.confirm('Desfazer somente a importação pedagógica? Nenhum dado do ADM-ESTUDO original será alterado.'))return true;
    const result=restorePedagogyImport({confirmed:true});
    if(!result.ok)throw Error(result.message);
    pendingPedagogy=null;pedagogyBackupRequested=false;
    window.alert(result.message);await rerender();return true;
  }
  if(op==='migration-preview'){
    if(route[1]!=='compatibilidade')throw Error('Prévia disponível somente em Históricos.');
    pendingLegacyImport=await prepareLegacyMigration();
    manualBackupInitiated=false;
    await rerender();return true;
  }
  if(op==='migration-commit'){
    if(route[1]!=='compatibilidade'||!pendingLegacyImport||!manualBackupInitiated)
      throw Error('Faça a prévia e solicite o backup antes de confirmar.');
    if(!window.confirm('Você baixou, abriu e conferiu o arquivo JSON com os DOIS históricos? Caso contrário, cancele.'))return true;
    if(!window.confirm(`IMPORTAÇÃO OPCIONAL: adicionar ${pendingLegacyImport.counts.importedQuestions} questões e ${pendingLegacyImport.counts.importedAttempts} tentativas verificadas ao motor novo? O ADM-ESTUDO original será preservado.`))return true;
    const result=commitLegacyMigration(pendingLegacyImport,{backupConfirmed:true});
    if(!result.ok)throw Error(result.message);
    pendingLegacyImport=null;manualBackupInitiated=false;
    window.alert(`Importação concluída: ${result.importedQuestions} questões, ${result.importedAttempts} tentativas. O histórico antigo permaneceu intacto.`);
    await rerender();return true;
  }
  if(op==='migration-discard'){
    if(route[1]!=='compatibilidade')throw Error('Ação disponível somente em Históricos.');
    if(!window.confirm('Liberar a cópia técnica de uma operação não aplicada? Só é permitido quando o histórico novo continua idêntico ao anterior.'))return true;
    const result=discardUnappliedRecovery({confirmed:true});
    if(!result.ok)throw Error(result.message);
    await rerender();return true;
  }
  if(op==='migration-restore'){
    if(route[1]!=='compatibilidade')throw Error('Restauração disponível apenas em Históricos.');
    if(!window.confirm('Desfazer a importação e voltar ao histórico NOVO anterior? Isto não altera o ADM-ESTUDO original. A operação só é permitida sem estudo posterior à importação.'))return true;
    const result=restorePreMigration({confirmed:true});
    if(!result.ok)throw Error(result.message);
    pendingLegacyImport=null;manualBackupInitiated=false;
    window.alert(result.message);
    await rerender();return true;
  }
  if(op==='dual-export'){
    if(route[1]!=='compatibilidade')throw Error('Exportação indisponível nesta tela.');
    const payload=buildDualHistorySnapshot();
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const download=document.createElement('a');
    download.href=url;download.download=`estudo-concursos-historicos-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(download);download.click();download.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);manualBackupInitiated=true;await rerender();return true;
  }
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
