import { describe, it, expect } from 'vitest';
import { GUIAS } from '../../src/ayuda/guias';
import { correrSketch } from '../ayuda/correr-sketch';

describe('programas de las guías de la Ayuda', { timeout: 300_000 }, () => {
  it('cada guía compila y corre sin avisos de cableado', async () => {
    for (const g of GUIAS) {
      const { sim, texto } = await correrSketch(g.programa, { duracionUs: 2_000_000 });
      expect(texto, g.id).not.toBe('');
      expect(sim.avisos, g.id).toEqual([]);
    }
  });
});
