import { describe, it, expect } from 'vitest';
import { Bitacora, formatoTiempo } from '../../src/ui/bitacora';

describe('bitácora de mensajes', () => {
  it('corta en líneas y quita \\r', () => {
    const b = new Bitacora();
    b.agregarSerial(1.5, 'hola\r\nchao\r\n');
    expect(b.lineas).toEqual([{ t: 1.5, texto: 'hola', tipo: 'serial' }, { t: 1.5, texto: 'chao', tipo: 'serial' }]);
    expect(b.abierta).toBeNull();
  });

  it('una línea sin terminar sigue con la próxima escritura y conserva su tiempo', () => {
    const b = new Bitacora();
    b.agregarSerial(1, 'Lín');
    expect(b.abierta).toEqual({ t: 1, texto: 'Lín', tipo: 'serial' });
    b.agregarSerial(2, 'ea en 3500\nsig');
    expect(b.lineas).toEqual([{ t: 1, texto: 'Línea en 3500', tipo: 'serial' }]);
    expect(b.abierta).toEqual({ t: 2, texto: 'sig', tipo: 'serial' });
  });

  it('guarda solo las últimas 500', () => {
    const b = new Bitacora();
    for (let i = 0; i < 600; i++) b.agregarSerial(i, `${i}\n`);
    expect(b.lineas).toHaveLength(500);
    expect(b.lineas[0].texto).toBe('100');
    b.agregarSistema(600, 'aviso');
    expect(b.lineas).toHaveLength(500);
    expect(b.lineas.at(-1)).toEqual({ t: 600, texto: 'aviso', tipo: 'sistema' });
  });

  it('limpiar borra todo, también la abierta, y cada cambio sube la versión', () => {
    const b = new Bitacora();
    const v0 = b.version;
    b.agregarSerial(0, 'uno\ndos');
    expect(b.version).toBeGreaterThan(v0);
    const v1 = b.version;
    b.limpiar();
    expect(b.version).toBeGreaterThan(v1);
    expect(b.lineas).toEqual([]);
    expect(b.abierta).toBeNull();
  });

  it('visibles cuenta la línea abierta dentro de las 500', () => {
    const b = new Bitacora();
    for (let i = 0; i < 600; i++) b.agregarSerial(i, `${i}\n`);
    b.agregarSerial(600, 'a medias');
    const visibles = b.visibles();
    expect(visibles).toHaveLength(500);
    expect(visibles.at(-1)).toEqual({ t: 600, texto: 'a medias', tipo: 'serial' });
    expect(visibles[0].texto).toBe('101');
  });

  it('formatoTiempo usa una decimal con coma', () => {
    expect(formatoTiempo(12.345)).toBe('12,3 s');
    expect(formatoTiempo(0)).toBe('0,0 s');
  });
});
