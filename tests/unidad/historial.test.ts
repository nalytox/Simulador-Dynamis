import { it, expect } from 'vitest';
import { Historial } from '../../src/pista/historial';

it('hace, deshace y rehace en orden', () => {
  const h = new Historial<string>();
  expect(h.puedeDeshacer).toBe(false);
  h.hacer('a');            // estaba en «a» y pasó a «b»
  h.hacer('b');            // pasó a «c»
  expect(h.deshacer('c')).toBe('b');
  expect(h.deshacer('b')).toBe('a');
  expect(h.deshacer('a')).toBeNull();
  expect(h.rehacer('a')).toBe('b');
  expect(h.rehacer('b')).toBe('c');
  expect(h.rehacer('c')).toBeNull();
});

it('hacer algo nuevo después de deshacer borra lo que se podía rehacer', () => {
  const h = new Historial<string>();
  h.hacer('a');
  expect(h.deshacer('b')).toBe('a');
  expect(h.puedeRehacer).toBe(true);
  h.hacer('a');
  expect(h.puedeRehacer).toBe(false);
});

it('guarda a lo más el límite de pasos, olvidando los más viejos', () => {
  const h = new Historial<number>(100);
  for (let i = 0; i < 150; i++) h.hacer(i);
  let n = 0;
  let actual = 150;
  for (let p = h.deshacer(actual); p !== null; p = h.deshacer(actual)) { actual = p; n++; }
  expect(n).toBe(100);
  expect(actual).toBe(50);
  h.vaciar();
  expect(h.puedeDeshacer || h.puedeRehacer).toBe(false);
});
