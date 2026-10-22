import { it, expect } from 'vitest';
import { crearRelieve } from '../../src/mundo/relieve';
import { crearSuperficie } from '../../src/mundo/superficie';
import { pistaDe } from '../ayuda/pistas';

const TAN20 = Math.tan(20 * Math.PI / 180);
const rampa = (rot: number) => crearRelieve(pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 1, r: 0, tipo: 'rampa', rot, props: { angulo: 20 } }] }));

it('la rampa sube hacia +u local y gira con la baldosa', () => {
  expect(rampa(0).altura(310, 150)).toBeCloseTo(10 * TAN20); expect(rampa(0).altura(590, 150)).toBeCloseTo(290 * TAN20);
  expect(rampa(90).altura(450, 10)).toBeCloseTo(10 * TAN20); expect(rampa(90).altura(450, 290)).toBeCloseTo(290 * TAN20);
  expect(rampa(180).altura(310, 150)).toBeCloseTo(290 * TAN20); expect(rampa(270).altura(450, 290)).toBeCloseTo(10 * TAN20);
});

it('nivel de la baldosa, celdas vacías y fuera de la grilla', () => {
  const r = crearRelieve(pistaDe({ columnas: 2, filas: 1, baldosas: [{ c: 0, r: 0, tipo: 'recta', nivel: 109 }] }));
  expect([r.altura(150, 150), r.altura(450, 150), r.altura(-10, 150), r.altura(150, 400)]).toEqual([109, 0, 0, 0]);
  expect(r.inclinacion(-10, 150, 0)).toEqual({ pitch: 0, roll: 0 });
});

it('inclinación en la rampa: de frente, de espaldas y de costado', () => {
  const r = rampa(0);
  expect(r.inclinacion(450, 150, 0).pitch).toBeCloseTo(-20 * Math.PI / 180, 4);
  expect(r.inclinacion(450, 150, Math.PI).pitch).toBeCloseTo(20 * Math.PI / 180, 4);
  const lado = r.inclinacion(450, 150, Math.PI / 2);
  expect(lado.pitch).toBeCloseTo(0, 4); expect(lado.roll).toBeCloseTo(-20 * Math.PI / 180, 4);
});

it('bache: medio cilindro que no cambia el color del suelo', () => {
  const p = pistaDe({ columnas: 3, filas: 1, baldosas: [{ c: 1, r: 0, tipo: 'recta' }],
    objetos: [{ tipo: 'bache', x: 450, y: 150, rot: 90, props: { largo: 300, radio: 6 } }] });
  const r = crearRelieve(p);
  expect(r.altura(450, 150)).toBeCloseTo(6); expect(r.altura(453, 150)).toBeCloseTo(Math.sqrt(27)); expect(r.altura(456.5, 150)).toBe(0);
  expect(r.altura(450, 299)).toBeCloseTo(6); expect(r.altura(450, 301)).toBe(0);
  expect(crearSuperficie(p).esLinea(450, 150)).toBe(true);
});
