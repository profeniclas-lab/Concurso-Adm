/** Cadastro de disciplinas — apenas metadados, sem carregar questões. */
export const SUBJECTS = Object.freeze([
  Object.freeze({
    id:'administracao', title:'Administração e Direito Administrativo', shortTitle:'Administração',
    icon:'🏛️', areas:Object.freeze(['ADM','AP','DA']), status:'legacy', storageMode:'existing',
    description:'Conteúdo e funcionalidades preservados do ADM-ESTUDO.'
  }),
  Object.freeze({
    id:'portugues', title:'Português e Redação Oficial', shortTitle:'Português',
    icon:'📖', areas:Object.freeze(['POR','RED']), status:'ready', storageMode:'isolated',
    description:'Catálogo e motor preparados para receber módulos.'
  }),
  Object.freeze({
    id:'matematica', title:'Matemática e Raciocínio Lógico', shortTitle:'Matemática',
    icon:'🔢', areas:Object.freeze(['MAT','RLM']), status:'ready', storageMode:'isolated',
    description:'Catálogo e motor preparados para receber módulos.'
  }),
  Object.freeze({
    id:'informatica', title:'Informática', shortTitle:'Informática',
    icon:'💻', areas:Object.freeze(['INF']), status:'ready', storageMode:'isolated',
    description:'Catálogo e motor preparados para receber módulos.'
  }),
  Object.freeze({
    id:'constitucional', title:'Direito Constitucional', shortTitle:'Constitucional',
    icon:'⚖️', areas:Object.freeze(['CON']), status:'ready', storageMode:'isolated',
    description:'Catálogo e motor preparados para receber módulos.'
  })
]);
const byId = new Map(SUBJECTS.map(subject=>[subject.id,subject]));
const byArea = new Map(SUBJECTS.flatMap(subject=>subject.areas.map(area=>[area,subject])));
export function listSubjects(){return [...SUBJECTS]}
export function getSubject(id){return byId.get(id) ?? null}
export function assertKnownSubject(id){const found=getSubject(id);if(!found)throw new Error(`Disciplina desconhecida: ${String(id)}`);return found}
export function getSubjectByModuleId(moduleId){if(typeof moduleId!=='string'|| !/^[A-Z]{2,5}-\d{2,3}$/.test(moduleId))return null;return byArea.get(moduleId.split('-')[0])??null}
