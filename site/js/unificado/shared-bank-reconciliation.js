/** Fase 8D — conciliação POR ID do Banco. Zero escrita, zero inferência de tentativa.
 * A cópia F7C só possui pontuação agregada do Banco; não inventamos IDs perdidos.
 */
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const validTime=x=>typeof x==='string'&&Number.isFinite(Date.parse(x));
const validAnswer=(v,q)=>Number.isInteger(v)&&v>=0&&v<q.options.length;
const pct=(a,b)=>b?100*a/b:0;
const entries=x=>obj(x)?Object.entries(x):[];
const bankRecord=(record,q)=>{
 if(!obj(record))return null;
 const b=obj(record.bankAttempt)?record.bankAttempt:null;
 if(b&&Number.isInteger(b.lastAnswer))return validAnswer(b.lastAnswer,q)?
   {answer:b.lastAnswer,at:validTime(b.updatedAt)?b.updatedAt:null}:null;
 if(['acerto_banco','erro_banco'].includes(record.assessment)&&validAnswer(record.lastAnswer,q))
   return {answer:record.lastAnswer,at:validTime(record.updatedAt)?record.updatedAt:null};
 return null;
};
/** Nunca altera `training` nem `baselineProgress`.
 * status: unchanged/merged/native-only/frozen/none. `component` é opcional.
 */
export function reconcileBankEvidence({moduleId,questions,baselineProgress={},originalBank=null,
  training=null,source='imported'}={}){
 if(!Array.isArray(questions)||!moduleId)throw Error('Catálogo não está disponível para conciliação.');
 const lookup=new Map();for(const q of questions){
  if(!q||q.moduleId!==moduleId||typeof q.id!=='string'||lookup.has(q.id)||
    !Array.isArray(q.options)||!Number.isInteger(q.answer)||!validAnswer(q.answer,q))
    throw Error('Questões incompatíveis com a conciliação do Banco.');
  lookup.set(q.id,q);
 }
 const oldComponent=originalBank?.available===true?originalBank:null;
 const oldRecords=obj(baselineProgress.questionHistory)?baselineProgress.questionHistory:{};
 const modern=new Map();let invalidNative=false;
 for(const [id,record] of entries(training?.questions)){
  if(record?.moduleId!==moduleId)continue;
  const q=lookup.get(id);
  if(!q){if(record?.history?.some(h=>h?.source==='bank'))invalidNative=true;continue;}
  const list=Array.isArray(record.history)?record.history.filter(h=>h?.source==='bank'):[];
  if(!list.length)continue;
  const last=list.at(-1);
  if(!validAnswer(last.answer,q)||!validTime(last.at)||last.correct!==(last.answer===q.answer))invalidNative=true;
  else modern.set(id,{answer:last.answer,at:last.at});
 }
 const nativeCount=modern.size;
 const preserved=reason=>({status:oldComponent?'frozen':'none',reason,oldCount:0,
   nativeCount,overlap:0,total:null,applied:false,component:null});
 if(invalidNative)return preserved('Há tentativa do Banco incompatível com o catálogo; a nota anterior foi preservada.');
 if(!nativeCount)return {status:oldComponent?'unchanged':'none',reason:null,oldCount:0,
   nativeCount:0,overlap:0,total:null,applied:false,component:null};
 if(!oldComponent){
  const correct=[...modern].filter(([id,x])=>x.answer===lookup.get(id).answer).length;
  return {status:'native-only',reason:null,oldCount:0,nativeCount,overlap:0,total:nativeCount,
    correct,applied:true,component:{available:true,score:pct(correct,nativeCount),coverage:100}};
 }
 if(source!=='legacy')return preserved('A cópia pedagógica F7C não guarda respostas individuais do Banco. A nota herdada permanece congelada.');
 const old=new Map();for(const [id,record] of entries(oldRecords)){
  const q=lookup.get(id);if(!q)continue;
  const evidence=bankRecord(record,q);if(evidence)old.set(id,evidence);
 }
 const oldCorrect=[...old].filter(([id,x])=>x.answer===lookup.get(id).answer).length;
 const oldScore=pct(oldCorrect,old.size);
 // Confirma equivalência com o componente de origem ANTES de misturar IDs.
 if(!old.size||Math.abs(oldScore-oldComponent.score)>0.011||oldComponent.coverage!==100)
   return preserved('Evidência antiga não reproduz a pontuação original; mantida sem alteração.');
 const merged=new Map(old);let overlap=0;
 for(const [id,rec] of modern){
  const prev=merged.get(id);
  if(prev){
   overlap++;
   if(!validTime(prev.at))return preserved('Uma resposta antiga sobreposta não tem data verificável; sem conciliação.');
   const diff=Date.parse(rec.at)-Date.parse(prev.at);
   if(!diff)return preserved('Há respostas de duas fontes com a mesma data; sem preferência artificial.');
   if(diff>0)merged.set(id,rec);
  }else merged.set(id,rec);
 }
 const correct=[...merged].filter(([id,x])=>x.answer===lookup.get(id).answer).length;
 return {status:'merged',reason:null,oldCount:old.size,nativeCount,overlap,
  total:merged.size,correct,applied:true,
  component:{available:true,score:pct(correct,merged.size),coverage:100}};
}
