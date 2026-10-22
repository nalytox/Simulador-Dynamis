import { it, expect } from 'vitest';
import { crearAgente } from '../../src/ajuste/agente.js';
import { calcularRecompensa, debeTerminar } from '../../src/ajuste/recompensa.js';
import { esFaltaImplementar, FaltaImplementar, type ParametroAgente, type RegistroPrueba, type PasoRegistro } from '../../src/ajuste/contrato';
import { mundoPlano } from '../../src/mundo/plano';
import { agenteDePrueba, recompensaDePrueba } from '../ayuda/ajuste-de-prueba';

const PARAMETROS: ParametroAgente[] = [
  { id: 'siguelineas.kp', grupo: 'siguelineas', nombre: 'kp', valor: 0.05, min: 0, max: 0.1 },
  { id: 'siguelineas.VEL', grupo: 'siguelineas', nombre: 'VEL', valor: 100, min: 50, max: 200 },
];
const PASO: PasoRegistro = {
  t: 0.01, estado: { x: 150, y: 150, z: 0, yaw: 0, pitch: 0, roll: 0 },
  lecturas: { qtr: [0, 0, 0, 0, 0, 0, 0, 0], distanciaMm: 8190, color: { r: 0, g: 0, b: 0, c: 0 }, mpu: { ax: 0, ay: 0, az: 9.81, gx: 0, gy: 0, gz: 0, temp: 25 } },
  motores: { izq: { duty: 0, modo: 'libre' }, der: { duty: 0, modo: 'libre' } }, eventos: [],
};
const REGISTRO: RegistroPrueba = {
  valores: { 'siguelineas.kp': 0.05 }, semilla: 1, duracionS: 1, pasos: [PASO], juez: null, fin: { motivo: 'tiempo', detalle: null },
};

function lanzado(f: () => unknown): unknown {
  try { f(); } catch (e) { return e; }
  throw new Error('no lanzó');
}

it('los archivos del profe lanzan FaltaImplementar con su archivo', () => {
  const agente = lanzado(() => crearAgente({ parametros: PARAMETROS, presupuesto: 10 }));
  expect(agente).toBeInstanceOf(FaltaImplementar);
  expect(esFaltaImplementar(agente)).toBe(true);
  expect((agente as Error).message).toBe('Para entrenar falta que tu profe programe el agente (src/ajuste/agente.js).');
  for (const f of [() => calcularRecompensa(REGISTRO), () => debeTerminar(PASO, mundoPlano())]) {
    const e = lanzado(f);
    expect(esFaltaImplementar(e)).toBe(true);
    expect((e as Error).message).toBe('Para entrenar falta que tu profe programe la recompensa (src/ajuste/recompensa.js).');
  }
});

it('esFaltaImplementar reconoce el error después de pasar por structuredClone', () => {
  const e = new FaltaImplementar('la recompensa', 'src/ajuste/recompensa.js');
  expect(esFaltaImplementar(structuredClone({ name: e.name, message: e.message }))).toBe(true);
  expect(esFaltaImplementar(new Error('otra cosa'))).toBe(false);
  expect(esFaltaImplementar(null)).toBe(false);
});

it('los dobles de prueba cumplen el contrato', () => {
  const agente = agenteDePrueba(7)({ parametros: PARAMETROS, presupuesto: 5 });
  for (let i = 0; i < 5; i++) {
    const v = agente.proponer();
    expect(Object.keys(v).sort()).toEqual(['siguelineas.VEL', 'siguelineas.kp']);
    for (const p of PARAMETROS) {
      expect(v[p.id]).toBeGreaterThanOrEqual(p.min);
      expect(v[p.id]).toBeLessThanOrEqual(p.max);
    }
    agente.aprender(v, i, { motivo: 'tiempo', detalle: null, t: 1, puntaje: 0, hitos: 0, meta: false });
  }
  expect(typeof recompensaDePrueba.calcularRecompensa(REGISTRO)).toBe('number');
  expect(recompensaDePrueba.debeTerminar({ ...PASO, eventos: ['perdio-linea'] }, mundoPlano())).toBe('perdio-linea');
  expect(recompensaDePrueba.debeTerminar(PASO, mundoPlano())).toBe(false);
});
