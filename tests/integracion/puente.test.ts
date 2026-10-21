import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { compilarParaPrueba, PEGAMENTO } from '../ayuda/compilar-prueba';
import { crearAnfitrionFalso } from '../ayuda/anfitrion-falso';
import { crearImports, type Anfitrion } from '../../src/simulacion/puente';
import { clasificarErrorEjecucion } from '../../src/simulacion/errores';
import type { ArchivosNucleo } from '../../src/compilador/compilar';

const NUCLEO: ArchivosNucleo = {
  cabeceras: {
    'Arduino.h': '#pragma once\n#include "dynamis_host.h"\n#include <stdio.h>\n#include <stdlib.h>\n',
    'dynamis_host.h': readFileSync('src/nucleo/include/dynamis_host.h', 'utf8'),
  },
  biblioteca: null,
};

type Exports = { _initialize(): void; dyn_setup(): void; memory: WebAssembly.Memory };

async function compilarPrueba(codigo: string) {
  return compilarParaPrueba({ 'p.ino': codigo, 'pegamento.cpp': PEGAMENTO }, NUCLEO, 'p');
}

async function instanciar(codigo: string, anfitrion: Anfitrion): Promise<Exports> {
  const modulo = await compilarPrueba(codigo);
  let instancia: WebAssembly.Instance | undefined;
  instancia = await WebAssembly.instantiate(modulo, crearImports(modulo, anfitrion, () => (instancia!.exports as Exports).memory));
  const ex = instancia.exports as Exports;
  ex._initialize();
  return ex;
}

async function correr(codigo: string, anfitrion: Anfitrion) {
  (await instanciar(codigo, anfitrion)).dyn_setup();
}

async function correrEsperandoError(codigo: string): Promise<unknown> {
  const ex = await instanciar(codigo, crearAnfitrionFalso().anfitrion);
  try { ex.dyn_setup(); } catch (e) { return e; }
  throw new Error('dyn_setup no lanzó ningún error');
}

describe('puente wasm ↔ anfitrión', { timeout: 120_000 }, () => {
  it('traduce cada import al anfitrión con valores sin signo y textos UTF-8', async () => {
    const { anfitrion, llamadas, texto } = crearAnfitrionFalso();
    await correr('void setup() { dyn_pin_mode(18, 3); dyn_digital_write(18, 1); dyn_delay(3000000000u); dyn_serial_write((const uint8_t*)"\\xC2\\xA1ol\\xC3\\xA1", 6); dyn_ledc_attach(21, 5000, 10); }\nvoid loop() {}', anfitrion);
    expect(llamadas.filter(l => l[0] !== 'serialWrite')).toEqual([['pinMode', 18, 3], ['digitalWrite', 18, 1], ['delay', 3000000000], ['ledcAttach', 21, 5000, 10]]);
    expect(texto()).toBe('¡olá');
  });

  it('printf llega por la salida estándar', async () => {
    const { anfitrion, texto } = crearAnfitrionFalso();
    await correr('void setup() { printf("x=%d\\n", 5); fflush(stdout); }\nvoid loop() {}', anfitrion);
    expect(texto()).toBe('x=5\n');
  });

  it.each([
    ['division-por-cero', 'void setup() { volatile int z = 0; volatile int r = 10 / z; }'],
    ['memoria', 'void setup() { *(volatile int*)0x7ffffff0 = 1; }'],
    ['memoria', 'int f(int n) { volatile char a[512]; a[0] = n; return f(n + 1) + a[0]; }\nvoid setup() { f(0); }'],
    ['sin-return', 'int f(int x) { if (x > 0) return 1; }\nvoid setup() { volatile int r = f(0); }'],
    ['salida', 'void setup() { exit(3); }'],
  ])('clasifica el error de ejecución %s', async (tipo, codigo) => {
    const err = await correrEsperandoError(codigo + '\nvoid loop() {}');
    expect(clasificarErrorEjecucion(err).tipo).toBe(tipo);
  });

  it('rechaza imports desconocidos', async () => {
    const modulo = await compilarPrueba('DYN_IMPORTAR("inexistente") void dyn_inexistente(void);\nvoid setup() { dyn_inexistente(); }\nvoid loop() {}');
    expect(() => crearImports(modulo, crearAnfitrionFalso().anfitrion, () => new WebAssembly.Memory({ initial: 1 })))
      .toThrow('El núcleo pide una función desconocida: inexistente');
  });
});
