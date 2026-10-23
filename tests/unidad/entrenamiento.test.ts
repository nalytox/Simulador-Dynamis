import { it, expect } from 'vitest';
import { acotarPropuesta, entrenar, type FinEntrenamiento } from '../../src/ajuste/entrenamiento';
import type { PoolPruebas } from '../../src/ajuste/pool';
import type { ResultadoPrueba } from '../../src/ajuste/prueba';
import type { CrearAgente, ParametroAgente } from '../../src/ajuste/contrato';
import { crearAgente as agenteDelProfe } from '../../src/ajuste/agente.js';

const PARAMETROS: ParametroAgente[] = [
  { id: 'g.a', grupo: 'g', nombre: 'a', valor: 4, entero: false, min: 0, max: 10 },
  { id: 'g.b', grupo: 'g', nombre: 'b', valor: 4, entero: false, min: 0, max: 10 },
];

/** Pool que responde en orden, con las recompensas dadas (o con `fallar`). */
function poolFalso(tamano: number, recompensas: number[], fallar?: Error) {
  let enCurso = 0;
  const estado = { maximoEnCurso: 0, valores: [] as Record<string, number>[], cerrado: false };
  const pool: PoolPruebas = {
    tamano,
    probar(valores, semilla) {
      enCurso++;
      estado.maximoEnCurso = Math.max(estado.maximoEnCurso, enCurso);
      estado.valores.push(valores);
      const recompensa = recompensas[estado.valores.length - 1] ?? 0;
      return new Promise<ResultadoPrueba>((resolver, rechazar) => queueMicrotask(() => {
        enCurso--;
        if (fallar) rechazar(fallar);
        else resolver({ valores, recompensa, semilla, trayectoria: [], resumen: { motivo: 'tiempo', detalle: null, t: 1, puntaje: 0, hitos: 0, meta: false } });
      }));
    },
    cerrar() { estado.cerrado = true; },
  };
  return { pool, estado };
}

const agenteFijo = (aprendidos: number[] = []): CrearAgente => () => ({
  proponer: () => ({ 'g.a': 1, 'g.b': 2 }),
  aprender: (_v, r) => { aprendidos.push(r); },
});

function correr(crearAgente: CrearAgente, pool: PoolPruebas, presupuesto: number, resultados: unknown[] = [], senal = new AbortController().signal): Promise<FinEntrenamiento> {
  return entrenar({ crearAgente, parametros: PARAMETROS, presupuesto, pool, semilla: () => 1, senal, alResultado: r => resultados.push(r) });
}

it('respeta el presupuesto y la cantidad de pruebas a la vez', async () => {
  const { pool, estado } = poolFalso(3, [1, 2, 3, 4, 5, 6, 7]);
  const resultados: unknown[] = [];
  const fin = await correr(agenteFijo(), pool, 7, resultados);
  expect(fin.motivo).toBe('completo');
  expect(resultados).toHaveLength(7);
  expect(estado.valores).toHaveLength(7);
  expect(estado.maximoEnCurso).toBe(3);
  expect(estado.cerrado).toBe(true);
});

it('el agente aprende cada resultado y se marca el récord', async () => {
  const aprendidos: number[] = [];
  const resultados: { indice: number; record: boolean }[] = [];
  const fin = await correr(agenteFijo(aprendidos), poolFalso(1, [5, 3, 8]).pool, 3, resultados);
  expect(aprendidos).toEqual([5, 3, 8]);
  expect(resultados.map(r => [r.indice, r.record])).toEqual([[1, true], [2, false], [3, true]]);
  expect(fin.mejor).toMatchObject({ indice: 3, recompensa: 8 });
});

it('acotarPropuesta sanea lo que propone el agente', () => {
  expect(acotarPropuesta({ 'g.a': NaN, 'g.b': 99, 'g.c': 1 }, PARAMETROS)).toEqual({ 'g.a': 4, 'g.b': 10 });
  expect(acotarPropuesta({}, PARAMETROS)).toEqual({ 'g.a': 4, 'g.b': 4 });
  expect(acotarPropuesta(null as unknown as Record<string, number>, PARAMETROS)).toEqual({ 'g.a': 4, 'g.b': 4 });
  expect(acotarPropuesta({ 'g.a': -3, 'g.b': '7' as unknown as number }, PARAMETROS)).toEqual({ 'g.a': 0, 'g.b': 4 });
});

it('acotarPropuesta redondea los enteros: la prueba usa el mismo valor que después se escribe', () => {
  const enteros: ParametroAgente[] = [
    { id: 'g.v', grupo: 'g', nombre: 'v', valor: 1, entero: true, min: 0, max: 5 },
    { id: 'g.w', grupo: 'g', nombre: 'w', valor: 2, entero: true, min: 0.5, max: 3.5 },
  ];
  expect(acotarPropuesta({ 'g.v': 2.7, 'g.w': 3.6 }, enteros)).toEqual({ 'g.v': 3, 'g.w': 3 });
  expect(acotarPropuesta({ 'g.v': 9.2, 'g.w': 0.6 }, enteros)).toEqual({ 'g.v': 5, 'g.w': 1 });
});

it('un agente que falta detiene el entrenamiento con faltaImplementar', async () => {
  const { pool, estado } = poolFalso(2, []);
  const fin = await correr(agenteDelProfe as CrearAgente, pool, 5);
  expect(fin).toMatchObject({ motivo: 'error', mejor: null, error: { faltaImplementar: true, mensaje: 'Para entrenar falta que tu profe programe el agente (src/ajuste/agente.js).' } });
  expect(estado.cerrado).toBe(true);
  expect(estado.valores).toEqual([]);
});

it('una excepción del agente o una recompensa que falta lo detienen', async () => {
  const roto: CrearAgente = () => ({ proponer: () => { throw new Error('se me olvidó el rango'); }, aprender: () => {} });
  const fin = await correr(roto, poolFalso(2, []).pool, 5);
  expect(fin).toMatchObject({ motivo: 'error', error: { faltaImplementar: false, mensaje: 'Algo falló en el simulador, avisa a tu profe.' } });
  expect(fin.error!.tecnico).toContain('el agente del profe');
  expect(fin.error!.tecnico).toContain('se me olvidó el rango');

  const falta = Object.assign(new Error('Para entrenar falta que tu profe programe la recompensa (src/ajuste/recompensa.js).'), { name: 'FaltaImplementar' });
  const fin2 = await correr(agenteFijo(), poolFalso(2, [], falta).pool, 5);
  expect(fin2).toMatchObject({ motivo: 'error', error: { faltaImplementar: true, mensaje: falta.message } });
});

it("detener con la señal cierra el pool y da 'detenido'", async () => {
  const cerrado = { valor: false };
  const pool: PoolPruebas = { tamano: 2, probar: () => new Promise(() => {}), cerrar: () => { cerrado.valor = true; } };
  const control = new AbortController();
  const promesa = correr(agenteFijo(), pool, 5, [], control.signal);
  control.abort();
  expect(await promesa).toEqual({ motivo: 'detenido', mejor: null });
  expect(cerrado.valor).toBe(true);
});
