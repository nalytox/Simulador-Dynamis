import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { abrirAlmacen, BASE_DATOS, conRetardo } from '../../src/proyecto/almacen';
import { pistaDe } from '../ayuda/pistas';

describe('almacén del navegador', () => {
  it('guarda y lee el proyecto, la pista y las preferencias', async () => {
    const almacen = await abrirAlmacen('prueba');
    expect(almacen).not.toBeNull();
    const proyecto = { nombre: 'p', archivos: { 'p.ino': 'void setup() {}' } };
    const pista = pistaDe({ columnas: 1, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'partida' }] });
    await almacen!.guardar('proyecto', proyecto);
    await almacen!.guardar('pista', pista);
    await almacen!.guardar('preferencias', { velocidad: 200, archivoAbierto: 'p.ino' });
    const otraVez = await abrirAlmacen('prueba');
    expect(await otraVez!.leer('proyecto')).toEqual(proyecto);
    expect(await otraVez!.leer('pista')).toEqual(pista);
    expect(await otraVez!.leer('preferencias')).toEqual({ velocidad: 200, archivoAbierto: 'p.ino' });
  });

  it('sin IndexedDB, abrirAlmacen da null', async () => {
    expect(await abrirAlmacen('prueba', { open() { throw new Error('bloqueado'); } } as unknown as IDBFactory)).toBeNull();
    const conError = {
      open() {
        const pedido = { onerror: null as null | (() => void), error: new Error('cuota') };
        queueMicrotask(() => pedido.onerror?.());
        return pedido;
      },
    } as unknown as IDBFactory;
    expect(await abrirAlmacen('prueba', conError)).toBeNull();
  });

  it('sin nombre usa la base única del navegador; dos bases distintas no se mezclan', async () => {
    const unica = await abrirAlmacen();
    await unica!.guardar('proyecto', { nombre: 'p', archivos: { 'p.ino': '// mío' } });
    expect((await (await abrirAlmacen(BASE_DATOS))!.leer('proyecto'))?.archivos['p.ino']).toBe('// mío');
    expect(await (await abrirAlmacen('otra-base'))!.leer('proyecto')).toBeUndefined();
  });

  it('conRetardo junta varias llamadas en una', () => {
    vi.useFakeTimers();
    const f = vi.fn();
    const g = conRetardo(f);
    g(1); g(2); g(3);
    vi.advanceTimersByTime(499);
    expect(f).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(f).toHaveBeenCalledTimes(1);
    expect(f).toHaveBeenCalledWith(3);
    vi.useRealTimers();
  });
});
