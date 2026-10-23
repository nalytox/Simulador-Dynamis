import { describe, it, expect } from 'vitest';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import { compilar } from '../../src/compilador/compilar';
import { Simulador } from '../../src/simulacion/simulador';
import { compilarParaPrueba } from '../ayuda/compilar-prueba';

const ARCHIVOS = {
  'p.ino': [
    '#include "config.h"',
    'float v = 0.5; // @ajustar prueba',
    'void setup() { Serial.begin(115200); Serial.print(v); Serial.print(\' \'); Serial.println(LADO * 1.5); }',
    'void loop() {}',
  ].join('\n'),
  'config.h': '#pragma once\n#define LADO 2 // @ajustar prueba\n',
};

async function correr(modulo: WebAssembly.Module, ajustes?: Record<string, number>): Promise<string> {
  const sim = await Simulador.crear({ modulo, ajustes });
  sim.ejecutar(10_000);
  return sim.tomarSerial();
}

describe('@ajustar', { timeout: 120_000 }, () => {
  it('@ajustar cambia el comportamiento sin recompilar', async () => {
    const modulo = await compilarParaPrueba(ARCHIVOS, await cargarNucleoDesdeDisco(), 'p');
    expect(await correr(modulo)).toBe('0.50 3.00\r\n');
    expect(await correr(modulo, { 'prueba.v': 2.25, 'prueba.LADO': 4 })).toBe('2.25 6.00\r\n');
    expect(await correr(modulo, { 'otro.v': 9 })).toBe('0.50 3.00\r\n');
  });

  it('un #define entero marcado sigue siendo entero', async () => {
    const codigo = ['#define VEL 200 // @ajustar g', 'void setup() { Serial.begin(115200); Serial.print(VEL); Serial.print(\' \'); Serial.println(min(VEL, 255) % 7); }', 'void loop() {}'].join('\n');
    const modulo = await compilarParaPrueba({ 'p.ino': codigo }, await cargarNucleoDesdeDisco(), 'p');
    expect(await correr(modulo)).toBe('200 4\r\n');
    expect(await correr(modulo, { 'g.VEL': 150 })).toBe('150 3\r\n');
  });

  it('un error de compilación sigue apuntando a la línea original', async () => {
    const codigo = ['float a = 1; // @ajustar g', '#define B 2 // @ajustar g', 'int x = a + B', 'void setup() {}', 'void loop() {}'].join('\n');
    const r = await compilar({ nombre: 'p', archivos: { 'p.ino': codigo } }, await cargarNucleoDesdeDisco());
    expect(r.ok).toBe(false);
    expect(r.diagnosticos[0]).toMatchObject({ archivo: 'p.ino', linea: 3, severidad: 'error' });
  });
});
