// RECOMPENSA DEL ENTRENAMIENTO — la implementa el profesor.
// Contrato, qué recibe y cuándo se llama: ver src/ajuste/README.md.
import { FaltaImplementar } from './contrato';

/**
 * Cuánto vale una prueba: mientras más alto, mejor lo hizo el robot. Corre en el worker de la prueba,
 * al terminarla (y en el hilo principal si el programa se quedó en un ciclo sin fin).
 *
 * @param {import('./contrato').RegistroPrueba} registro
 *   `{ valores, semilla, duracionS, pasos, juez, fin }`: los pasos cada 10 ms con estado, lecturas,
 *   motores y eventos; el juez virtual al final (o null); y por qué terminó la prueba.
 * @returns {number} Un número finito.
 */
export function calcularRecompensa(registro) {
  // TODO(profe): programar la recompensa.
  void registro;
  throw new FaltaImplementar('la recompensa', 'src/ajuste/recompensa.js');
}

/**
 * Si la prueba debe terminar antes de su duración máxima. Se llama en cada paso del registro.
 *
 * @param {import('./contrato').PasoRegistro} paso `{ t, estado, lecturas, motores, eventos }`
 * @param {import('../mundo/tipos').Mundo} mundo Las primitivas de la pista (ver src/modelos/README.md).
 * @returns {false | string} `false` para seguir, o el motivo para terminar.
 */
export function debeTerminar(paso, mundo) {
  // TODO(profe): decidir cuándo cortar una prueba antes de tiempo.
  void paso;
  void mundo;
  throw new FaltaImplementar('la recompensa', 'src/ajuste/recompensa.js');
}
