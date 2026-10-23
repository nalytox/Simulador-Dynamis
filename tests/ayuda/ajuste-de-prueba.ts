import { crearAzar } from '../../src/simulacion/azar';
import type { CrearAgente, ModuloRecompensa } from '../../src/ajuste/contrato';

/**
 * Agente y recompensa para las pruebas del motor de entrenamiento. No son los del profe: solo
 * cumplen el contrato de src/ajuste/contrato.ts de la forma más simple y reproducible.
 */
export const agenteDePrueba = (semilla: number): CrearAgente => ({ parametros }) => {
  const azar = crearAzar(semilla);
  return {
    proponer: () => Object.fromEntries(parametros.map(p => [p.id, p.min + azar() * (p.max - p.min)])),
    aprender: () => {},
  };
};

export const recompensaDePrueba: ModuloRecompensa = {
  calcularRecompensa: r => (r.juez?.puntaje ?? 0) + (r.pasos.at(-1)?.estado.x ?? 0) / 1000,
  debeTerminar: paso => (paso.eventos.includes('perdio-linea') ? 'perdio-linea' : false),
};
