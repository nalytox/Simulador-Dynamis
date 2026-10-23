// AGENTE DE APRENDIZAJE POR REFUERZO — lo implementa el profesor.
// Contrato, qué recibe y cuándo se llama: ver src/ajuste/README.md.
import { FaltaImplementar } from './contrato';

/**
 * Crea el agente que decide qué valores probar en cada prueba del entrenamiento. Corre en el hilo
 * principal de la página.
 *
 * @param {object} opciones
 * @param {import('./contrato').ParametroAgente[]} opciones.parametros
 *   Los valores que el estudiante eligió ajustar: `{ id, grupo, nombre, valor, min, max }`.
 *   `valor` es el que tiene hoy en el código; `min` y `max`, el rango de búsqueda de la ventana.
 * @param {number} opciones.presupuesto Cuántas pruebas se harán en total.
 * @returns {import('./contrato').Agente}
 *   `{ proponer(), aprender(valores, recompensa, resumen) }`:
 *   - `proponer()` devuelve `{ [id]: número }` para una prueba nueva. Se puede llamar varias veces
 *     antes de recibir resultados (hay varios robots practicando a la vez).
 *   - `aprender(valores, recompensa, resumen)` recibe el resultado de una prueba: los valores que
 *     se usaron, la recompensa (de `recompensa.js`) y el resumen de la prueba.
 */
export function crearAgente({ parametros, presupuesto }) {
  // TODO(profe): programar el agente de aprendizaje por refuerzo.
  void parametros;
  void presupuesto;
  throw new FaltaImplementar('el agente', 'src/ajuste/agente.js');
}
