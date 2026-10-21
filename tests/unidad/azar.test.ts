import { describe, it, expect } from 'vitest';
import { crearAzar } from '../../src/simulacion/azar';

const cinco = (semilla: number) => { const a = crearAzar(semilla); return Array.from({ length: 5 }, () => a()); };

describe('crearAzar', () => {
  it('la misma semilla da la misma secuencia', () => expect(cinco(7)).toEqual(cinco(7)));
  it('semillas distintas dan secuencias distintas', () => expect(cinco(7)).not.toEqual(cinco(8)));
  it('todos los valores están en [0, 1)', () => {
    const a = crearAzar(123);
    for (let i = 0; i < 1000; i++) { const v = a(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});
