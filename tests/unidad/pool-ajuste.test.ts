import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { crearPool } from '../../src/ajuste/pool';
import { pistaDe } from '../ayuda/pistas';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';
import type { RegistroPrueba } from '../../src/ajuste/contrato';

class TrabajadorFalso {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  enviados: { tipo: string; [k: string]: unknown }[] = [];
  terminado = false;
  postMessage(m: { tipo: string }) { this.enviados.push(m); }
  terminate() { this.terminado = true; }
  emitir(data: unknown) { this.onmessage?.({ data }); }
  ultimoId() { return this.enviados.filter(m => m.tipo === 'probar').at(-1)!.id; }
}

const PISTA = pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'partida' }], inicio: { x: 150, y: 150, yaw: 0 } });
const MODULO = new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
const resultado = (valores: Record<string, number>, recompensa: number) =>
  ({ valores, recompensa, semilla: 1, trayectoria: [], resumen: { motivo: 'tiempo', detalle: null, t: 1, puntaje: 0, hitos: 0, meta: false } });

function preparar(tamano: number, recompensaPrincipal = vi.fn((_r: RegistroPrueba) => 7)) {
  const trabajadores: TrabajadorFalso[] = [];
  const pool = crearPool({
    modulo: MODULO, pista: PISTA, robot: ROBOT_POR_DEFECTO, duracionS: 10, tamano, recompensaPrincipal,
    crearTrabajador: () => {
      const t = new TrabajadorFalso();
      trabajadores.push(t);
      return t as unknown as Worker;
    },
  });
  return { pool, trabajadores, recompensaPrincipal };
}

describe('pool de workers del entrenamiento', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('cada worker recibe el módulo una vez y las pruebas se reparten', async () => {
    const { pool, trabajadores } = preparar(2);
    expect(pool.tamano).toBe(2);
    const p1 = pool.probar({ 'g.a': 1 }, 11);
    pool.probar({ 'g.a': 2 }, 12);
    pool.probar({ 'g.a': 3 }, 13);
    expect(trabajadores).toHaveLength(2);
    for (const [i, t] of trabajadores.entries()) {
      expect(t.enviados[0]).toMatchObject({ tipo: 'iniciar', modulo: MODULO, pista: PISTA, robot: ROBOT_POR_DEFECTO, duracionS: 10, indice: i });
      expect(t.enviados.filter(m => m.tipo === 'iniciar')).toHaveLength(1);
    }
    expect(trabajadores[0].enviados[1]).toMatchObject({ tipo: 'probar', valores: { 'g.a': 1 }, semilla: 11 });
    expect(trabajadores[1].enviados[1]).toMatchObject({ tipo: 'probar', valores: { 'g.a': 2 }, semilla: 12 });
    trabajadores[0].emitir({ tipo: 'resultado', id: trabajadores[0].ultimoId(), resultado: resultado({ 'g.a': 1 }, 5) });
    await expect(p1).resolves.toMatchObject({ recompensa: 5 });
    expect(trabajadores[0].enviados[2]).toMatchObject({ tipo: 'probar', valores: { 'g.a': 3 }, semilla: 13 });
  });

  it('un error del worker rechaza la prueba con su nombre y su detalle', async () => {
    const { pool, trabajadores } = preparar(1);
    const p = pool.probar({}, 1);
    trabajadores[0].emitir({ tipo: 'error', id: trabajadores[0].ultimoId(), error: { nombre: 'FaltaImplementar', mensaje: 'falta', tecnico: 'pila' } });
    await expect(p).rejects.toMatchObject({ name: 'FaltaImplementar', message: 'falta', tecnico: 'pila' });
  });

  it('un worker sin latidos se reemplaza y la prueba da ciclo-sin-fin', async () => {
    const { pool, trabajadores, recompensaPrincipal } = preparar(1);
    const p = pool.probar({ 'g.a': 4 }, 21);
    const latidos = new Int32Array(trabajadores[0].enviados[0].latidos as SharedArrayBuffer);
    // Con latidos no se reemplaza.
    for (let i = 0; i < 6; i++) {
      Atomics.add(latidos, 0, 1);
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(trabajadores).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(2500);
    expect(trabajadores[0].terminado).toBe(true);
    expect(trabajadores).toHaveLength(2);
    expect(trabajadores[1].enviados[0]).toMatchObject({ tipo: 'iniciar', indice: 0 });
    const r = await p;
    expect(r).toMatchObject({ valores: { 'g.a': 4 }, semilla: 21, recompensa: 7, resumen: { motivo: 'ciclo-sin-fin', puntaje: 0 } });
    expect(recompensaPrincipal.mock.calls[0][0]).toMatchObject({ pasos: [], juez: null, fin: { motivo: 'ciclo-sin-fin' } });
    // El worker nuevo toma la próxima prueba.
    pool.probar({}, 22);
    expect(trabajadores[1].enviados[1]).toMatchObject({ tipo: 'probar', semilla: 22 });
  });

  it('mientras un worker carga no cuenta como colgado; desde su primer latido, sí', async () => {
    const { pool, trabajadores } = preparar(1);
    const p = pool.probar({ 'g.a': 4 }, 21);
    const latidos = new Int32Array(trabajadores[0].enviados[0].latidos as SharedArrayBuffer);
    // Un Chromebook lento tarda en cargar el worker: 5 s sin latidos no es un ciclo sin fin.
    await vi.advanceTimersByTimeAsync(5000);
    expect(trabajadores).toHaveLength(1);
    Atomics.add(latidos, 0, 1);
    await vi.advanceTimersByTimeAsync(2500);
    expect(trabajadores).toHaveLength(2);
    await expect(p).resolves.toMatchObject({ resumen: { motivo: 'ciclo-sin-fin' } });
  });

  it('un worker que nunca arranca se reemplaza y la prueba falla como error del simulador', async () => {
    const { pool, trabajadores } = preparar(1);
    const p = pool.probar({}, 1);
    const rechazo = expect(p).rejects.toMatchObject({ name: 'ErrorSimulador', message: 'El worker de la prueba no arrancó.' });
    await vi.advanceTimersByTimeAsync(20_500);
    expect(trabajadores).toHaveLength(2);
    await rechazo;
  });

  it('un worker que no carga deja en el detalle técnico el error, el archivo y la línea', async () => {
    const { pool, trabajadores } = preparar(1);
    const p = pool.probar({}, 1);
    trabajadores[0].onerror?.({ message: 'Uncaught ReferenceError: window is not defined', filename: 'http://localhost/src/ajuste/recompensa.js', lineno: 3, colno: 1 });
    const e = await p.catch((x: unknown) => x) as Error & { tecnico?: string };
    expect(e.name).toBe('ErrorSimulador');
    expect(e.tecnico).toContain('window is not defined');
    expect(e.tecnico).toContain('recompensa.js:3');
    expect(trabajadores).toHaveLength(2);
  });

  it('cerrar termina todos los workers y cancela lo pendiente', async () => {
    const { pool, trabajadores } = preparar(1);
    const enCurso = pool.probar({}, 1);
    const enCola = pool.probar({}, 2);
    pool.cerrar();
    expect(trabajadores.every(t => t.terminado)).toBe(true);
    await expect(enCurso).rejects.toMatchObject({ name: 'Cancelado' });
    await expect(enCola).rejects.toMatchObject({ name: 'Cancelado' });
    await vi.advanceTimersByTimeAsync(5000);
    expect(trabajadores).toHaveLength(1);
  });
});
