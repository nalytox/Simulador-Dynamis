import { describe, it, expect } from 'vitest';
import { nombreTipo, porcentajeUso, textoUso, textoValor } from '../../src/ui/textos-memoria';
import { ENTRADAS_NVS, memoriaVacia, type MemoriaNvs } from '../../src/simulacion/memoria';

const float32 = (x: number) => Array.from(new Uint8Array(new Float32Array([x]).buffer));
const float64 = (x: number) => Array.from(new Uint8Array(new Float64Array([x]).buffer));

describe('textos de la tarjeta Memoria del robot', () => {
  it('el uso de la memoria en entradas y porcentaje', () => {
    expect(textoUso(memoriaVacia())).toBe('0 de 504 entradas (0 %)');
    const una: MemoriaNvs = { espacios: { robot: { veces: { tipo: 'u32', bytes: [7, 0, 0, 0] } } } };
    expect(textoUso(una)).toBe('2 de 504 entradas (0 %)');
    const llena: MemoriaNvs = { espacios: { a: { b: { tipo: 'blob', bytes: Array((ENTRADAS_NVS - 3) * 32).fill(0) } } } };
    expect(textoUso(llena)).toBe('504 de 504 entradas (100 %)');
    expect(porcentajeUso(llena)).toBe(100);
  });

  it('los números según su tipo, con signo y de 64 bits', () => {
    expect(textoValor({ tipo: 'i8', bytes: [0xfb] })).toBe('-5');
    expect(textoValor({ tipo: 'u8', bytes: [250] })).toBe('250');
    expect(textoValor({ tipo: 'i16', bytes: [0xd4, 0xfe] })).toBe('-300');
    expect(textoValor({ tipo: 'u16', bytes: [0x60, 0xea] })).toBe('60000');
    expect(textoValor({ tipo: 'i32', bytes: [0x90, 0xee, 0xfe, 0xff] })).toBe('-70000');
    expect(textoValor({ tipo: 'u32', bytes: [0, 0x28, 0x6b, 0xee] })).toBe('4000000000');
    expect(textoValor({ tipo: 'i64', bytes: [0x00, 0xe6, 0x8e, 0xe7, 0xfd, 0xff, 0xff, 0xff] })).toBe('-9000000000');
    expect(textoValor({ tipo: 'u64', bytes: [255, 255, 255, 255, 255, 255, 255, 255] })).toBe('18446744073709551615');
  });

  it('los textos entre comillas y los bytes como lista, recortada si es larga', () => {
    expect(textoValor({ tipo: 'str', bytes: [104, 111, 108, 97] })).toBe('«hola»');
    expect(textoValor({ tipo: 'blob', bytes: [1, 2, 3] })).toBe('[1, 2, 3]');
    expect(textoValor({ tipo: 'blob', bytes: Array.from({ length: 20 }, (_, i) => i) })).toBe('[0, 1, 2, 3, 4, 5, 6, 7, …] (20 bytes)');
  });

  it('un bloque de 4 u 8 bytes dice qué decimal sería', () => {
    expect(textoValor({ tipo: 'blob', bytes: float32(3.14) })).toBe(`[${float32(3.14).join(', ')}] = 3,14 si es un decimal (float)`);
    expect(textoValor({ tipo: 'blob', bytes: float64(2.718281828) })).toBe(`[${float64(2.718281828).join(', ')}] = 2,7183 si es un decimal (double)`);
  });

  it('el nombre de cada tipo', () => {
    expect(nombreTipo('i32')).toBe('número (int)');
    expect(nombreTipo('u8')).toBe('número (uchar o bool)');
    expect(nombreTipo('str')).toBe('texto');
    expect(nombreTipo('blob')).toBe('bytes');
  });
});
