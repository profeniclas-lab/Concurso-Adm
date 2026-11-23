/** Copiar este conjunto para: site/js/unificado/content/<disciplina>/<ID>/
 * Trocar MODULE_ID pelo id real e adicionar os dados nos arquivos irmãos.
 * Template não é carregado pelo aplicativo. Não inclui questões fictícias.
 */
import {makeModuleBundle} from '../../../content-contract.js';
import {LESSONS} from './lessons.js';
import {DIAGNOSTIC} from './diagnostic.js';
import {EXERCISES} from './exercises.js';
import {AUTHORIAL} from './questions-authorial.js';
import {REAL} from './questions-real.js';
import {FLASHCARDS} from './flashcards.js';
export default makeModuleBundle({
  moduleId:'MODULE_ID',lessons:LESSONS,diagnostic:DIAGNOSTIC,
  exercises:EXERCISES,questions:[...AUTHORIAL,...REAL],flashcards:FLASHCARDS
});
