import { describe, it, expect } from 'vitest';
import { ClienteCompilador, firmaProyecto } from '../../src/compilador/cliente';
import type { Proyecto } from '../../src/proyecto/proyecto';

/** El módulo wasm vacío más chico que existe. */
const WASM_MINIMO = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]);

/** Un Worker de mentira: responde como el trabajador del compilador, en el próximo turno. */
class TrabajadorFalso {
  onmessage: ((e: { data: unknown }) => void) | null = null;
  compilaciones = 0;
  preparaciones = 0;
  constructor(private fallosAlPreparar = 0) {}
  private responder(data: unknown) { queueMicrotask(() => this.onmessage?.({ data })); }
  postMessage(m: { tipo: string; id?: number; proyecto?: Proyecto }) {
    if (m.tipo === 'preparar') {
      this.preparaciones++;
      if (this.fallosAlPreparar-- > 0) return this.responder({ tipo: 'error-preparar', mensaje: 'sin red' });
      this.responder({ tipo: 'progreso', hecho: 50, total: 100 });
      this.responder({ tipo: 'preparado' });
    } else if (m.tipo === 'compilar') {
      this.compilaciones++;
      const conError = Object.values(m.proyecto!.archivos).some(t => t.includes('ERROR'));
      this.responder({ tipo: 'compilado', id: m.id, resultado: conError
        ? { ok: false, diagnosticos: [{ archivo: 'p.ino', linea: 1, columna: 1, severidad: 'error', mensaje: 'x', detalle: '' }] }
        : { ok: true, wasm: WASM_MINIMO, diagnosticos: [] } });
    }
  }
  terminate() {}
}

const proyecto = (codigo: string): Proyecto => ({ nombre: 'p', archivos: { 'p.ino': codigo, 'pines.h': '#pragma once' } });
const cliente = (falso: TrabajadorFalso) => new ClienteCompilador(() => falso as unknown as Worker);

describe('cliente del compilador', () => {
  it('firmaProyecto no depende del orden de los archivos y cambia con el contenido', () => {
    const a = firmaProyecto({ nombre: 'p', archivos: { 'p.ino': 'a', 'b.h': 'b' } });
    expect(firmaProyecto({ nombre: 'p', archivos: { 'b.h': 'b', 'p.ino': 'a' } })).toBe(a);
    expect(firmaProyecto({ nombre: 'p', archivos: { 'p.ino': 'a', 'b.h': 'c' } })).not.toBe(a);
    expect(firmaProyecto({ nombre: 'p', archivos: { 'p.ino': 'ab', 'b.h': '' } })).not.toBe(a);
  });

  it('compilar dos veces el mismo proyecto habla una sola vez con el trabajador', async () => {
    const falso = new TrabajadorFalso();
    const c = cliente(falso);
    const r1 = await c.compilar(proyecto('void setup() {}'));
    const r2 = await c.compilar(proyecto('void setup() {}'));
    expect(r1.ok && r2.ok).toBe(true);
    if (r1.ok && r2.ok) expect(r2.modulo).toBe(r1.modulo);
    expect(falso.compilaciones).toBe(1);
  });

  it('un proyecto distinto vuelve a compilar; un resultado con errores no queda en caché', async () => {
    const falso = new TrabajadorFalso();
    const c = cliente(falso);
    await c.compilar(proyecto('uno'));
    await c.compilar(proyecto('dos'));
    const malo1 = await c.compilar(proyecto('ERROR'));
    const malo2 = await c.compilar(proyecto('ERROR'));
    expect(malo1.ok || malo2.ok).toBe(false);
    if (!malo1.ok) expect(malo1.diagnosticos[0].linea).toBe(1);
    expect(falso.compilaciones).toBe(4);
  });

  it('preparar reenvía el progreso y rechaza con el mensaje si la descarga falla; la segunda llamada reintenta', async () => {
    const falso = new TrabajadorFalso(1);
    const c = cliente(falso);
    await expect(c.preparar(() => {})).rejects.toThrow('sin red');
    const progreso: [number, number][] = [];
    await c.preparar((hecho, total) => progreso.push([hecho, total]));
    expect(progreso).toEqual([[50, 100]]);
    expect(falso.preparaciones).toBe(2);
  });
});
