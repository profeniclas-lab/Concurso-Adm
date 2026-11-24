/** Fase 8A: leitor nativo comum. A leitura NÃO grava progresso.
 * Questões interativas permanecem no treino já existente da Fase 6.
 */
import {loadSharedModule} from './shared-module-loader.js';
import {getSubject} from './subjects.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
const text=x=>esc(x).replace(/\n/g,'\n');
const nav=(id,mod)=>`#estudo/${encodeURIComponent(id)}/${encodeURIComponent(mod)}`;
function lessonView(bundle,i){
 const topics=bundle.subtopics.filter(x=>bundle.lessons[x.id]);
 if(!Number.isSafeInteger(i)||i<1||i>topics.length)throw Error('Página da aula inválida.');
 const t=topics[i-1],l=bundle.lessons[t.id],base=nav(bundle.subjectId,bundle.moduleId);
 const fields=[['Objetivo da aula',l.objective],['Entenda o conceito',l.concept],['Explicação',l.explanation],
   ['Exemplo na prática',l.example],['Como aparece em concursos',l.examTip],['Resumo para revisar',l.summary]];
 return `<article class="activity-card"><p class="eyebrow">Aula ${i} de ${topics.length} · ${esc(t.id)}</p><h2>${esc(t.title)}</h2>
 ${fields.filter(([,v])=>typeof v==='string'&&v.trim()).map(([h,v])=>`<section><h3>${esc(h)}</h3><p class="native-paragraph">${text(v)}</p></section>`).join('')}
 ${l.reviewQuestion?`<details class="preview-answer"><summary>Recuperação ativa: ${esc(l.reviewQuestion)}</summary><p class="native-paragraph">${text(l.reviewAnswer)}</p></details>`:''}
 </article><nav class="preview-pagination" aria-label="Navegação pelas aulas">
 ${i>1?`<a class="btn" href="${base}/aula/${i-1}">← Aula anterior</a>`:''}
 <span>${i} / ${topics.length}</span>
 ${i<topics.length?`<a class="btn btn-primary" href="${base}/aula/${i+1}">Próxima aula →</a>`:''}</nav>`;
}
function diagnosticView(bundle,i){
 const cards=bundle.diagnostic;
 if(!Number.isSafeInteger(i)||i<1||i>cards.length)throw Error('Cartão diagnóstico inválido.');
 const q=cards[i-1],base=nav(bundle.subjectId,bundle.moduleId);
 return `<article class="activity-card"><p class="eyebrow">Diagnóstico ${i} de ${cards.length}</p>
 <h2>${esc(bundle.subtopics.find(x=>x.id===q.subtopicId)?.title??q.subtopicId)}</h2>
 <p class="native-paragraph">${text(q.front)}</p>
 <details class="preview-answer"><summary>Revelar resposta</summary><p class="native-paragraph">${text(q.back)}</p></details></article>
 <nav class="preview-pagination" aria-label="Navegação do diagnóstico">${i>1?`<a class="btn" href="${base}/diagnostico/${i-1}">← Anterior</a>`:''}<span>${i} / ${cards.length}</span>
 ${i<cards.length?`<a class="btn btn-primary" href="${base}/diagnostico/${i+1}">Próximo →</a>`:''}</nav>`;
}
function indexView(bundle){
 const base=nav(bundle.subjectId,bundle.moduleId);
 return `<section class="panel"><h2>Conteúdos do módulo</h2>
 <p>As aulas e os diagnósticos abaixo são carregados apenas quando você abre este módulo. O texto é idêntico à fonte administrativa aprovada.</p>
 <div class="module-list">${bundle.subtopics.map((t,i)=>`<div class="module-item"><strong>${i+1}. ${esc(t.title)}</strong>
 <div class="inline-actions">${bundle.lessons[t.id]?`<a class="btn" href="${base}/aula/${i+1}">Ler aula</a>`:''}
 ${bundle.diagnostic.some(c=>c.subtopicId===t.id)?`<a class="btn" href="${base}/diagnostico/${i+1}">Diagnóstico</a>`:''}</div></div>`).join('')}</div></section>`;
}
export async function renderSharedModule(route,main,isCurrent=()=>true,loader=loadSharedModule){
 if(route[0]!=='estudo'||route.length<3||route.length>5)throw Error('Rota de estudo inválida.');
 const [,subjectId,moduleId,screen='inicio',index='1']=route;
 const subject=getSubject(subjectId);if(!subject)throw Error('Disciplina desconhecida.');
 const bundle=await loader(subjectId,moduleId);
 if(!isCurrent())return;
 const base=nav(subjectId,moduleId);
 const content=screen==='inicio'&&route.length===3?indexView(bundle):
   screen==='aula'&&route.length===5?lessonView(bundle,Number(index)):
   screen==='diagnostico'&&route.length===5?diagnosticView(bundle,Number(index)):
   null;
 if(content===null)throw Error('Página do módulo inválida.');
 const actions=subjectId==='administracao'
   ?`<a class="btn" href="#treino-admin/modulo/${esc(moduleId)}">Meu progresso</a><a class="btn btn-primary" href="#treino-admin/banco/${esc(moduleId)}/1">Responder questões</a>`
   :`<a class="btn" href="#materia/${esc(subjectId)}">Voltar à disciplina</a>`;
 main.innerHTML=`<div class="section-head"><div><p class="eyebrow">Motor compartilhado · Fase 8A</p><h1>${esc(bundle.moduleId)} — ${esc(bundle.title)}</h1></div>
 <a class="btn" href="${base}">← Índice do módulo</a></div>
 <div class="inline-actions">${actions}</div>
 <p class="notice" role="note">Esta visualização nativa é <strong>somente leitura nesta fase</strong>. Abrir aulas e cartões não marca conclusão nem altera o aproveitamento. Use a área de treino existente para registrar respostas.</p>
 ${content}`;
}
