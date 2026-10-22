import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClienteSimulacion, type EventosSimulacion } from '../../src/simulacion/cliente';
import { IDX, PAUSA, CORRIENDO } from '../../src/simulacion/control';
import type { Instantanea, FinEjecucion } from '../../src/simulacion/ejecucion';
import { pistaDe } from '../ayuda/pistas';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

class TrabajadorFalso {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  enviados: { tipo: string; control?: SharedArrayBuffer; [k: string]: unknown }[] = [];
  terminado = false;
  postMessage(m: { tipo: string }) { this.enviados.push(m); }
  terminate() { this.terminado = true; }
  emitir(data: unknown) { this.onmessage?.({ data }); }
  get control() { return new Int32Array(this.enviados[0].control!); }
}

const PISTA = pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'partida' }] });
const MODULO = new WebAssembly.Module(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
const OPCIONES = { modulo: MODULO, pista: PISTA, robot: ROBOT_POR_DEFECTO, desde: 'partida', semilla: 3, velocidad: 200 };

function preparar() {
  const trabajadores: TrabajadorFalso[] = [];
  const eventos = { alInstantanea: vi.fn(), alTerminar: vi.fn(), alAtascarse: vi.fn() } satisfies EventosSimulacion;
  const cliente = new ClienteSimulacion(eventos, () => {
    const t = new TrabajadorFalso();
    trabajadores.push(t);
    return t as unknown as Worker;
  });
  return { cliente, eventos, trabajadores };
}

describe('cliente de la simulación', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('iniciar envía el módulo, la pista, el robot, desde y el bloque de control', () => {
    const { cliente, trabajadores } = preparar();
    cliente.iniciar(OPCIONES);
    const m = trabajadores[0].enviados[0];
    expect(m).toMatchObject({ tipo: 'iniciar', modulo: MODULO, pista: PISTA, robot: ROBOT_POR_DEFECTO, desde: 'partida', semilla: 3 });
    expect(m.control).toBeInstanceOf(SharedArrayBuffer);
    expect(trabajadores[0].control[IDX.velocidad]).toBe(200);
    expect(cliente.corriendo).toBe(true);
  });

  it('pausar, seguir, velocidad y pedidos escriben en el bloque de control', () => {
    const { cliente, trabajadores } = preparar();
    cliente.iniciar(OPCIONES);
    const c = trabajadores[0].control;
    cliente.pausar();
    expect(c[IDX.estado]).toBe(PAUSA);
    expect(cliente.enPausa).toBe(true);
    cliente.seguir();
    expect(c[IDX.estado]).toBe(CORRIENDO);
    cliente.fijarVelocidad(50);
    expect(c[IDX.velocidad]).toBe(50);
    cliente.pedir('siguiente');
    expect(c[IDX.pedido]).toBe(2);
  });

  it('si el latido no cambia en 2 s mientras corre avisa que se atascó, una sola vez', () => {
    const { cliente, eventos } = preparar();
    cliente.iniciar(OPCIONES);
    vi.advanceTimersByTime(1500);
    expect(eventos.alAtascarse).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(eventos.alAtascarse).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(eventos.alAtascarse).toHaveBeenCalledTimes(1);
  });

  it('en pausa no avisa, y si el latido cambia tampoco', () => {
    const { cliente, eventos, trabajadores } = preparar();
    cliente.iniciar(OPCIONES);
    const c = trabajadores[0].control;
    for (let i = 0; i < 10; i++) {
      Atomics.add(c, IDX.latido, 1);
      vi.advanceTimersByTime(500);
    }
    cliente.pausar();
    vi.advanceTimersByTime(10_000);
    cliente.seguir();
    vi.advanceTimersByTime(1000);
    expect(eventos.alAtascarse).not.toHaveBeenCalled();
  });

  it('detener termina el trabajador y no vuelve a avisar', () => {
    const { cliente, eventos, trabajadores } = preparar();
    cliente.iniciar(OPCIONES);
    cliente.detener();
    expect(trabajadores[0].terminado).toBe(true);
    expect(cliente.corriendo).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(eventos.alAtascarse).not.toHaveBeenCalled();
  });

  it('reenvía instantáneas y el fin; después del fin ya no corre', () => {
    const { cliente, eventos, trabajadores } = preparar();
    cliente.iniciar(OPCIONES);
    const instantanea = { t: 1 } as unknown as Instantanea;
    const fin = { motivo: 'terminado', juez: null } as unknown as FinEjecucion;
    trabajadores[0].emitir({ tipo: 'instantanea', datos: instantanea });
    trabajadores[0].emitir({ tipo: 'fin', datos: fin });
    expect(eventos.alInstantanea).toHaveBeenCalledWith(instantanea);
    expect(eventos.alTerminar).toHaveBeenCalledWith(fin);
    expect(cliente.corriendo).toBe(false);
    expect(trabajadores[0].terminado).toBe(true);
  });

  it('iniciar dos veces termina el primer trabajador', () => {
    const { cliente, eventos, trabajadores } = preparar();
    cliente.iniciar(OPCIONES);
    cliente.iniciar(OPCIONES);
    expect(trabajadores[0].terminado).toBe(true);
    trabajadores[0].emitir({ tipo: 'instantanea', datos: {} });
    expect(eventos.alInstantanea).not.toHaveBeenCalled();
    expect(cliente.corriendo).toBe(true);
  });
});
