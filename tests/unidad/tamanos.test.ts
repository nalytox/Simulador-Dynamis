import { it, expect } from 'vitest';
import { acotar, TAMANOS_ORIGINALES } from '../../src/ui/tamanos';

it('el tamaño original reparte las columnas como siempre y no fija altos', () => {
  expect(TAMANOS_ORIGINALES).toEqual({ columna: 0.47, altoEditor: null, altoPista: null });
});

it('acota la columna de 30 % a 70 %, el editor de 200 a 1200 px y la pista de 200 px al alto de la pantalla', () => {
  expect(acotar({ columna: 0.1, altoEditor: 50, altoPista: 50 }, 900)).toEqual({ columna: 0.3, altoEditor: 200, altoPista: 200 });
  expect(acotar({ columna: 0.9, altoEditor: 5000, altoPista: 5000 }, 900)).toEqual({ columna: 0.7, altoEditor: 1200, altoPista: 900 });
  expect(acotar({ columna: 0.5, altoEditor: null, altoPista: 400 }, 900)).toEqual({ columna: 0.5, altoEditor: null, altoPista: 400 });
});

it('si la pantalla se achica, la pista también; un valor que no es un número vuelve al original', () => {
  expect(acotar({ columna: 0.5, altoEditor: 600, altoPista: 800 }, 500).altoPista).toBe(500);
  expect(acotar({ columna: Number.NaN, altoEditor: Number.NaN, altoPista: null }, 900)).toEqual({ columna: 0.47, altoEditor: null, altoPista: null });
});
