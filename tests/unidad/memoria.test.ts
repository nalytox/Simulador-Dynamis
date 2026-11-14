import { describe, it, expect } from 'vitest';
import { ENTRADAS_NVS, MemoriaRobot, entradasDe, entradasUsadas, memoriaVacia, type MemoriaNvs } from '../../src/simulacion/memoria';

const bytes = (...b: number[]) => new Uint8Array(b);
function nueva(inicial: MemoriaNvs = memoriaVacia()) {
  const avisos: string[] = [];
  return { m: new MemoriaRobot(inicial, t => avisos.push(t)), avisos };
}

describe('entradas de la NVS', () => {
  it('un número ocupa 1; un texto, 1 más una cada 32 bytes con su 0; un bloque, 2 más una cada 32 bytes', () => {
    expect(entradasDe({ tipo: 'i32', bytes: [0, 0, 0, 0] })).toBe(1);
    expect(entradasDe({ tipo: 'u8', bytes: [1] })).toBe(1);
    expect(entradasDe({ tipo: 'str', bytes: Array(40).fill(65) })).toBe(3);
    expect(entradasDe({ tipo: 'str', bytes: Array(31).fill(65) })).toBe(2);
    expect(entradasDe({ tipo: 'blob', bytes: Array(200).fill(0) })).toBe(9);
    expect(entradasDe({ tipo: 'blob', bytes: Array(4).fill(0) })).toBe(3);
  });

  it('cada espacio de nombres ocupa 1 entrada más', () => {
    expect(entradasUsadas(memoriaVacia())).toBe(0);
    expect(entradasUsadas({ espacios: { a: { k: { tipo: 'i32', bytes: [1, 0, 0, 0] } } } })).toBe(2);
    expect(entradasUsadas({ espacios: { a: {}, b: { k: { tipo: 'u8', bytes: [1] } } } })).toBe(3);
  });
});

describe('MemoriaRobot', () => {
  it('guarda, lee, da el tipo, quita y vacía', () => {
    const { m } = nueva();
    expect(m.abrir('robot', false)).toBe(true);
    expect(m.poner('robot', 'veces', 'u32', bytes(7, 0, 0, 0), 0)).toBe(4);
    expect(m.largo('robot', 'veces', 'u32')).toBe(4);
    expect(Array.from(m.leer('robot', 'veces')!)).toEqual([7, 0, 0, 0]);
    expect(m.tipo('robot', 'veces')).toBe(5);
    expect(m.tipo('robot', 'nada')).toBe(10);
    expect(m.libres()).toBe(ENTRADAS_NVS - 2);
    expect(m.escrituras).toBe(1);
    expect(m.ultima).toEqual({ espacio: 'robot', clave: 'veces' });
    expect(m.quitar('robot', 'veces')).toBe(true);
    expect(m.quitar('robot', 'veces')).toBe(false);
    m.poner('robot', 'a', 'u8', bytes(1), 0);
    expect(m.vaciar('robot')).toBe(true);
    expect(m.instantanea().espacios.robot).toEqual({});
  });

  it('un nombre de más de 15 letras no se acepta y avisa', () => {
    const { m, avisos } = nueva();
    expect(m.abrir('un-nombre-muy-largo', false)).toBe(false);
    m.abrir('ok', false);
    expect(m.poner('ok', 'clave-de-16-letr', 'u8', bytes(1), 0)).toBe(0);
    expect(avisos).toContain('El nombre "un-nombre-muy-largo" tiene más de 15 letras: la memoria no lo acepta.');
    expect(avisos).toContain('El nombre "clave-de-16-letr" tiene más de 15 letras: la memoria no lo acepta.');
  });

  it('en solo lectura no abre un espacio que no existe ni deja escribir', () => {
    const { m, avisos } = nueva();
    expect(m.abrir('nuevo', true)).toBe(false);
    const { m: m2, avisos: avisos2 } = nueva({ espacios: { cal: {} } });
    expect(m2.abrir('cal', true)).toBe(true);
    expect(m2.poner('cal', 'x', 'u8', bytes(1), 0)).toBe(0);
    expect(avisos2).toContain('Abriste la memoria "cal" en solo lectura: no se puede escribir en ella.');
    expect(avisos).toEqual([]);
  });

  it('un texto de más de 4000 bytes no se acepta', () => {
    const { m } = nueva();
    m.abrir('t', false);
    expect(m.poner('t', 'largo', 'str', new Uint8Array(4001).fill(65), 0)).toBe(0);
    expect(m.poner('t', 'justo', 'str', new Uint8Array(4000).fill(65), 0)).toBe(4000);
  });

  it('cuando se llena, poner devuelve 0 y libres nunca baja de 0', () => {
    const { m } = nueva();
    m.abrir('lleno', false);
    let i = 0;
    while (m.poner('lleno', `b${i}`, 'blob', new Uint8Array(500), i * 100_000) > 0) i++;
    expect(i).toBeGreaterThan(0);
    expect(m.libres()).toBeGreaterThanOrEqual(0);
    expect(entradasUsadas(m.instantanea())).toBeLessThanOrEqual(ENTRADAS_NVS);
    expect(m.libres()).toBe(ENTRADAS_NVS - entradasUsadas(m.instantanea()));
  });

  it('reescribir una clave libera lo que ocupaba antes', () => {
    const { m } = nueva();
    m.abrir('r', false);
    m.poner('r', 'tabla', 'blob', new Uint8Array(200), 0);
    const libres = m.libres();
    m.poner('r', 'tabla', 'blob', new Uint8Array(200), 100_000);
    expect(m.libres()).toBe(libres);
  });

  it('leer con otro tipo da −1 y avisa', () => {
    const { m, avisos } = nueva();
    m.abrir('e', false);
    m.poner('e', 'k', 'str', bytes(104, 111, 108, 97), 0);
    expect(m.largo('e', 'k', 'i32')).toBe(-1);
    expect(m.largo('e', 'k', null)).toBe(4);
    expect(m.largo('e', 'nada', 'i32')).toBe(-1);
    expect(avisos).toEqual(['Leíste "k" con otro tipo del que guardaste.']);
  });

  it('escribir sin parar avisa una vez que la flash se gasta', () => {
    const { m, avisos } = nueva();
    m.abrir('f', false);
    for (let i = 0; i < 25; i++) m.poner('f', 'x', 'u8', bytes(i), i * 20_000);
    for (let i = 0; i < 25; i++) m.poner('f', 'x', 'u8', bytes(i), 600_000 + i * 20_000);
    expect(avisos).toEqual(['Escribes la memoria muy seguido: la flash del ESP32 se gasta. Guarda solo cuando algo cambie.']);
  });

  it('escribir de vez en cuando no avisa', () => {
    const { m, avisos } = nueva();
    m.abrir('f', false);
    for (let i = 0; i < 25; i++) m.poner('f', 'x', 'u8', bytes(i), i * 100_000);
    expect(avisos).toEqual([]);
  });

  it('la instantánea es una copia, y la memoria inicial no cambia', () => {
    const inicial: MemoriaNvs = { espacios: { a: { k: { tipo: 'u8', bytes: [1] } } } };
    const { m } = nueva(inicial);
    m.abrir('a', false);
    m.poner('a', 'k', 'u8', bytes(2), 0);
    expect(inicial.espacios.a.k.bytes).toEqual([1]);
    const copia = m.instantanea();
    copia.espacios.a.k.bytes[0] = 9;
    expect(Array.from(m.leer('a', 'k')!)).toEqual([2]);
  });
});
