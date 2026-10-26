import { it, expect } from 'vitest';
import { textoAccion, textoAltura, textoPosicion, textoSubida } from '../../src/ui/textos-pista';
import { pistaVacia } from '../../src/pista/serializacion';
import { baldosaEn, colocarBaldosa } from '../../src/pista/edicion';

it('textoAccion nombra las 4 acciones', () => {
  expect(textoAccion('izq')).toBe('Girar a la izquierda');
  expect(textoAccion('der')).toBe('Girar a la derecha');
  expect(textoAccion('vuelta')).toBe('Dar la vuelta (180°)');
  expect(textoAccion('recto')).toBe('Seguir derecho');
});

it('textoPosicion cuenta columnas y filas desde 1', () => {
  const b = baldosaEn(colocarBaldosa(pistaVacia(), 5, 4, 'recta', 270), 5, 4)!;
  expect(textoPosicion(b)).toBe('Columna 6, fila 5 · 270°');
});

it('textoSubida y textoAltura usan cm con una decimal y coma', () => {
  expect(textoSubida(109.19)).toBe('sube 10,9 cm');
  expect(textoSubida(173.205)).toBe('sube 17,3 cm');
  expect(textoAltura(109.19)).toBe('10,9 cm');
  expect(textoAltura(50)).toBe('5 cm');
});
