/** Contrato técnico para NOVOS módulos. Não corrige nem transforma conteúdo de Administração. */
export function makeModuleBundle({moduleId,lessons={},diagnostic=[],exercises=[],questions=[],flashcards=[]}){
  if(typeof moduleId!=='string'||!moduleId)throw new TypeError('moduleId é obrigatório');
  if(!lessons||typeof lessons!=='object'||Array.isArray(lessons))throw new TypeError('lessons deve ser objeto');
  for(const [name,value] of Object.entries({diagnostic,exercises,questions,flashcards})){
    if(!Array.isArray(value))throw new TypeError(`${name} deve ser um array`);
  }
  return Object.freeze({moduleId,lessons,diagnostic,exercises,questions,flashcards});
}
