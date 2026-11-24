/**
 * Leitor SOMENTE de consulta do catálogo modular de Administração.
 * Carrega o manifesto pequeno; baixa apenas as questões do módulo solicitado.
 * NUNCA lê ou escreve localStorage, nem altera o motor de Administração.
 */
const FORMAT='estudo-concursos/admin-lazy-catalog/v1';
const MODULE_PATTERN=/^(?:ADM|AP|DA)-\d{2}$/;
const rootUrl=new URL('../../administracao/catalogo-leve/',import.meta.url);

export function createAdminCatalogLoader({
  fetcher=(url)=>fetch(url,{cache:'no-store'}),
  importer=(url)=>import(url)
}={}) {
  let catalogPromise=null;
  const cache=new Map();
  async function catalog() {
    if(!catalogPromise)catalogPromise=Promise.resolve().then(async()=>{
      const result=await fetcher(new URL('manifest.json',rootUrl).href);
      if(!result?.ok)throw new Error('O catálogo modular não foi publicado. Confira a Fase 5 no GitHub Actions.');
      const data=await result.json();
      if(data?.format!==FORMAT || data.questionCount!==757 || data.moduleCount!==27 || !Array.isArray(data.modules))
        throw new Error('Catálogo modular incompleto ou incompatível.');
      const ids=new Set();let count=0;
      for(const item of data.modules){
        if(!MODULE_PATTERN.test(item?.id) || ids.has(item.id) || item.file!==`questoes/${item.id}.js` || !Number.isInteger(item.count)||item.count<1)
          throw new Error('Estrutura dos módulos inválida.');
        count+=item.count;ids.add(item.id);
      }
      if(ids.size!==data.moduleCount || count!==data.questionCount)throw new Error('Contagens do catálogo não coincidem.');
      return data;
    }).catch(error=>{catalogPromise=null;throw error});
    return catalogPromise;
  }
  async function moduleQuestions(id){
    if(!MODULE_PATTERN.test(id))throw new Error('Identificador de módulo inválido.');
    const manifest=await catalog();
    const entry=manifest.modules.find(x=>x.id===id);
    if(!entry)throw new Error('Módulo não cadastrado.');
    if(!cache.has(id))cache.set(id,Promise.resolve().then(async()=>{
      const result=await importer(new URL(entry.file,rootUrl).href);
      const questions=result?.QUESTIONS;
      if(!Array.isArray(questions) || questions.length!==entry.count)
        throw new Error(`Quantidade de questões incorreta para ${id}.`);
      const seen=new Set();
      for(const q of questions){
        if(!q||q.moduleId!==id||typeof q.id!=='string'||seen.has(q.id)||!Array.isArray(q.options)||!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.options.length)
          throw new Error(`Questão inválida no módulo ${id}.`);
        seen.add(q.id);
      }
      return questions;
    }).catch(error=>{cache.delete(id);throw error}));
    return cache.get(id);
  }
  return { catalog,moduleQuestions };
}
const loader=createAdminCatalogLoader();
export const loadAdminCatalog=loader.catalog;
export const loadAdminQuestions=loader.moduleQuestions;
