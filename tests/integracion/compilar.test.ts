import { describe, it, expect } from 'vitest';
import { compilar, type ArchivosNucleo } from '../../src/compilador/compilar';
import { PEGAMENTO } from '../ayuda/compilar-prueba';

const NUCLEO_FALSO: ArchivosNucleo = { cabeceras: { 'Arduino.h': '#pragma once\n#define LED 2\n' }, biblioteca: null };

describe('compilar', { timeout: 120_000 }, () => {
  it('compila un proyecto con .ino, .h, src/*.cpp y .c', async () => {
    const r = await compilar({ nombre: 'robot', archivos: {
      'robot.ino': '#include "pines.h"\nint valor = LED + PIN;\nvoid setup() { avanzar(); }\nvoid loop() {}\n',
      'motores.ino': 'void avanzar() { valor++; }\n', 'pines.h': '#define PIN 18\n',
      'src/extra.cpp': 'int extra() { return 1; }\n', 'util.c': 'int g(void) { return 2; }\n', 'pegamento.cpp': PEGAMENTO } }, NUCLEO_FALSO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const nombres = WebAssembly.Module.exports(await WebAssembly.compile(r.wasm)).map(e => e.name);
    expect(nombres).toEqual(expect.arrayContaining(['memory', '_initialize', 'dyn_setup', 'dyn_loop']));
  });
  it('informa el archivo y la línea originales', async () => {
    const r = await compilar({ nombre: 'robot', archivos: { 'robot.ino': 'void setup() {}\nvoid loop() {}\n', 'motores.ino': 'void avanzar() {\n  int x = 3\n}\n' } }, NUCLEO_FALSO);
    expect(r.ok).toBe(false);
    expect(r.diagnosticos[0]).toMatchObject({ archivo: 'motores.ino', linea: 2, severidad: 'error' });
  });
  it('informa funciones que faltan al enlazar', async () => {
    const r = await compilar({ nombre: 'robot', archivos: { 'robot.ino': 'void avanzar();\nvoid setup() { avanzar(); }\nvoid loop() {}\n', 'pegamento.cpp': PEGAMENTO } }, NUCLEO_FALSO);
    expect(r).toMatchObject({ ok: false, diagnosticos: [{ archivo: null, severidad: 'error', mensaje: expect.stringContaining('avanzar') }] });
  });
  it('sin .ino responde con un diagnóstico claro', async () => {
    const r = await compilar({ nombre: 'x', archivos: { 'a.h': '' } }, NUCLEO_FALSO);
    expect(r).toMatchObject({ ok: false, diagnosticos: [{ mensaje: expect.stringContaining('no tiene ningún archivo .ino') }] });
  });
});
