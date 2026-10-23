import { describe, it, expect } from 'vitest';
import { vistaInicial, aPantalla, aMundoDesde, acercar, desplazar } from '../../src/ui/vista';

describe('vista del lienzo', () => {
  it('vistaInicial muestra toda la pista con margen', () => {
    const v = vistaInicial(1000, 600, 8, 6);
    for (const [x, y] of [[0, 0], [2400, 0], [0, 1800], [2400, 1800]]) {
      const { px, py } = aPantalla(v, x, y);
      expect(px).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(px).toBeLessThanOrEqual(984 + 1e-9);
      expect(py).toBeGreaterThanOrEqual(16 - 1e-9);
      expect(py).toBeLessThanOrEqual(584 + 1e-9);
    }
    expect(aPantalla(v, 0, 0).py).toBeGreaterThan(aPantalla(v, 0, 1800).py);
  });

  it('aPantalla y aMundoDesde son inversas', () => {
    const v = desplazar(vistaInicial(800, 600, 8, 6), 13, -7);
    const { px, py } = aPantalla(v, 1234, 567);
    const m = aMundoDesde(v, px, py);
    expect(m.x).toBeCloseTo(1234, 9);
    expect(m.y).toBeCloseTo(567, 9);
  });

  it('acercar deja fijo el punto bajo el cursor y respeta los límites', () => {
    const v = vistaInicial(1000, 600, 8, 6);
    const antes = aMundoDesde(v, 300, 200);
    const cerca = acercar(v, 2, 300, 200, v.escala);
    expect(cerca.escala).toBeCloseTo(v.escala * 2, 9);
    const despues = aMundoDesde(cerca, 300, 200);
    expect(despues.x).toBeCloseTo(antes.x, 9);
    expect(despues.y).toBeCloseTo(antes.y, 9);
    expect(acercar(v, 100, 0, 0, v.escala).escala).toBeCloseTo(v.escala * 8, 9);
    expect(acercar(v, 0.01, 0, 0, v.escala).escala).toBeCloseTo(v.escala, 9);
  });
});
