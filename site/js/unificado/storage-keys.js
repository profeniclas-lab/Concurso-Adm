import { assertKnownSubject } from './subjects.js';
/** A chave original é COMPARTILHADA apenas com a Administração incorporada, nunca alterada por este portal. */
export const EXISTING_ADM_KEY='admEstudo.v2.state';
export const UNIFIED_UI_STORAGE_KEY='estudoConcursos.v1.ui';
const NEW_PREFIX='estudoConcursos.v1.subject.';
export function getSubjectStorageKey(subjectId){const subject=assertKnownSubject(subjectId);return subject.storageMode==='existing'?EXISTING_ADM_KEY:NEW_PREFIX+subject.id}
export function isLegacySubject(subjectId){return assertKnownSubject(subjectId).storageMode==='existing'}
