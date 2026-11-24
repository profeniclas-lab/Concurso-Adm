/** Fase 8D — painel de aproveitamento EFETIVO, sem gravação ou fusão presumida.
 * Carrega nove módulos por página; o restante fica sob demanda.
 */
import {loadSharedAdminManifest,loadSharedModule} from './shared-module-loader.js';
import {buildSharedStudyView} from './shared-activity-bridge.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
export const ADMIN_PAGE_SIZE=9;
export function selectSharedDashboardPage(manifest,page,size=ADMIN_PAGE_SIZE){
 if(!Array.isArray(manifest?.modules)||manifest.moduleCount!==27||manifest.questionCount!==757||
    manifest.modules.length!==27||!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(size)||size<1)
   throw Error('Catálogo ou página de aproveitamento incompatível.');
 const pages=Math.ceil(manifest.modules.length/size);
 if(page>pages)throw Error('Página de módulos não encontrada.');
 return {pages,total:manifest.modules.length,items:manifest.modules.slice((page-1)*size,page*size)};
}
export async function computeSharedDashboardPage(manifest,page,{
 moduleLoader=loadSharedModule,viewLoader=buildSharedStudyView,size=ADMIN_PAGE_SIZE
}={}){
 const selection=selectSharedDashboardPage(manifest,page,size);
 const rows=await Promise.all(selection.items.map(async item=>{
  try{
   const bundle=await moduleLoader('administracao',item.id);
   if(bundle.moduleId!==item.id||bundle.subjectId!=='administracao')throw Error('Módulo divergente.');
   const view=await viewLoader(bundle);
   if(view.locked)return {id:item.id,title:bundle.title,locked:true,reason:view.reason??'Histórico incompatível.',source:view.source};
   if(!view.score)throw Error('Nota de módulo indisponível.');
   return {id:item.id,title:bundle.title,locked:false,
    points:view.score.hasData?view.score.earnedWeightedPoints:null,
    achieved:!!view.score.completed,source:view.source,
    nativeChanged:!!view.score.sourceChanged,
    evidence:view.score.evidence,
    bankStatus:view.score.bankReconciliation?.status??'unchanged'};
  }catch(error){return {id:item.id,title:item.title,locked:true,
    reason:'Não foi possível verificar este módulo: '+String(error.message||error)};}
 }));
 return {...selection,rows,checked:rows.length,
   atGoal:rows.filter(x=>!x.locked&&x.achieved).length,
   errors:rows.filter(x=>x.locked).length};
}
export async function renderSharedAdminDashboard(page,main,isCurrent=()=>true,{manifestLoader=loadSharedAdminManifest,
 moduleLoader=loadSharedModule,viewLoader=buildSharedStudyView}={}){
 if(!isCurrent())return;
 const manifest=await manifestLoader();if(!isCurrent())return;
 const result=await computeSharedDashboardPage(manifest,page,{moduleLoader,viewLoader});
 if(!isCurrent())return;
 const stat=x=>x===null?'Sem nota':`${x.toFixed(2).replace('.',',')} / 100`;
 const rangeFrom=(page-1)*ADMIN_PAGE_SIZE+1;
 main.innerHTML=`<section class="section-head"><div><p class="eyebrow">Motor compartilhado · Fase 8D</p>
 <h1>Aproveitamento atualizado por módulo</h1><p class="muted">Módulos ${rangeFrom}–${rangeFrom+result.rows.length-1} de 27. Aulas, diagnósticos, exercícios e Banco conciliado por ID quando possível.</p></div></section>
 <div class="inline-actions"><a class="btn" href="#materia/administracao">← Administração</a><a class="btn" href="#treino-admin/auditoria">Backup e auditoria</a><a class="btn" href="#materia/administracao/legado">Abrir versão original</a></div>
 <p class="notice" role="note">${result.atGoal} de ${result.checked} módulos desta página atingiram 75 pontos. ${result.errors?`${result.errors} módulos estão protegidos ou indisponíveis. `:''}Não é uma contagem global dos 27 módulos; consulte as demais páginas. Os históricos originais não são alterados.</p>
 <div class="module-list">${result.rows.map(x=>`<article class="module-item"><strong>${esc(x.id)} — ${esc(x.title)}</strong>
 ${x.locked?`<p class="notice error">${esc(x.reason)}</p>`:
 `<p><strong>${esc(stat(x.points))}</strong> · ${x.achieved?'Meta de 75 atingida':'Meta: 75 pontos'}</p>
 <small>Origem: ${x.source==='imported'?'cópia pedagógica F7C':x.source==='legacy'?'ADM-ESTUDO':'sem histórico herdado'}${x.nativeChanged?' · inclui atividade nativa':''}${x.bankStatus==='frozen'?' · Banco antigo preservado por falta de equivalência individual':''}</small>`}
 <div class="inline-actions"><a class="btn btn-primary" href="#estudo/administracao/${esc(x.id)}">Abrir módulo unificado</a><a class="btn" href="#treino-admin/banco/${esc(x.id)}/1">Banco</a></div></article>`).join('')}</div>
 <nav class="preview-pagination" aria-label="Páginas de aproveitamento">${page>1?`<a class="btn" href="#treino-admin/visao-unificada/${page-1}">← Anterior</a>`:''}
 <span>Página ${page} de ${result.pages}</span>${page<result.pages?`<a class="btn btn-primary" href="#treino-admin/visao-unificada/${page+1}">Próxima →</a>`:''}</nav>`;
}
