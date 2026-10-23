import { it, expect } from 'vitest';
import { ayudaDe, elecciones, GRUPOS, paraElAgente, rangoPorDefecto } from '../../src/ajuste/parametros';
import type { Ajustable } from '../../src/compilador/ajustables';

const ajustable = (nombre: string, valor: number, min: number | null = null, max: number | null = null): Ajustable => ({
  id: `siguelineas.${nombre}`, grupo: 'siguelineas', nombre, valor, entero: false, min, max, archivo: 'a.ino', linea: 1, forma: 'variable',
});

it('los grupos con nombre amigable son los de la spec', () => {
  expect(GRUPOS).toEqual([
    { id: 'siguelineas', nombre: 'Siguelíneas', sensor: 'QTR-MX-8A' },
    { id: 'giroscopio', nombre: 'Giroscopio', sensor: 'MPU6050' },
    { id: 'distancia', nombre: 'Distancia', sensor: 'VL53L0X' },
    { id: 'posicion', nombre: 'Posición', sensor: 'Posición del robot' },
  ]);
});

it('rangoPorDefecto', () => {
  expect(rangoPorDefecto(ajustable('kp', 0.08))).toEqual([0, 0.32]);
  expect(rangoPorDefecto(ajustable('x', -2))).toEqual([-8, 0]);
  expect(rangoPorDefecto(ajustable('x', 0))).toEqual([0, 1]);
  expect(rangoPorDefecto(ajustable('v', 100, 50, 200))).toEqual([50, 200]);
});

it('ayudaDe', () => {
  expect(ayudaDe('KP')).toBe('Qué tan fuerte corrige');
  expect(ayudaDe('ki')).toBe('Corrige el error que se va acumulando');
  expect(ayudaDe('Kd')).toBe('Frena los zigzags');
  expect(ayudaDe('velocidad')).toBe('Valor ajustable');
});

it('elecciones conserva lo elegido para los ids que siguen y agrega los nuevos encendidos', () => {
  const previas = [{ id: 'siguelineas.kp', ajustar: false, min: 0.01, max: 0.2, base: [0, 0.32] as [number, number] }, { id: 'siguelineas.viejo', ajustar: true, min: 0, max: 1, base: [0, 1] as [number, number] }];
  expect(elecciones([ajustable('kp', 0.08), ajustable('kd', 0.6)], previas)).toEqual([
    { id: 'siguelineas.kp', ajustar: false, min: 0.01, max: 0.2, base: [0, 0.32] },
    { id: 'siguelineas.kd', ajustar: true, min: 0, max: 2.4, base: [0, 2.4] },
  ]);
});

it('si cambia el rango de la marca, un rango que no se tocó en la ventana sigue a la marca', () => {
  const [antes] = elecciones([ajustable('kp', 0.08, 0, 0.1)], []);
  expect(antes).toEqual({ id: 'siguelineas.kp', ajustar: true, min: 0, max: 0.1, base: [0, 0.1] });
  expect(elecciones([ajustable('kp', 0.08, 0, 0.5)], [{ ...antes, ajustar: false }]))
    .toEqual([{ id: 'siguelineas.kp', ajustar: false, min: 0, max: 0.5, base: [0, 0.5] }]);
  // Uno editado en la ventana se conserva.
  expect(elecciones([ajustable('kp', 0.08, 0, 0.5)], [{ ...antes, max: 0.2 }]))
    .toEqual([{ id: 'siguelineas.kp', ajustar: true, min: 0, max: 0.2, base: [0, 0.5] }]);
});

it('paraElAgente', () => {
  const ps = [ajustable('kp', 0.08), ajustable('kd', 0.6)];
  expect(paraElAgente([], [])).toEqual({ ok: false, problema: 'Tu código no tiene valores marcados con @ajustar.' });
  expect(paraElAgente(ps, ps.map(p => ({ id: p.id, ajustar: false, min: 0, max: 1 }))))
    .toEqual({ ok: false, problema: 'Elige al menos un valor para ajustar.' });
  expect(paraElAgente(ps, [{ id: 'siguelineas.kp', ajustar: true, min: 1, max: 1 }, { id: 'siguelineas.kd', ajustar: false, min: 0, max: 1 }]))
    .toEqual({ ok: false, problema: 'El rango de kp no sirve: el mínimo debe ser menor que el máximo.' });
  expect(paraElAgente(ps, [{ id: 'siguelineas.kp', ajustar: true, min: NaN, max: 1 }, { id: 'siguelineas.kd', ajustar: false, min: 0, max: 1 }]))
    .toEqual({ ok: false, problema: 'El rango de kp no sirve: el mínimo debe ser menor que el máximo.' });
  expect(paraElAgente(ps, [{ id: 'siguelineas.kp', ajustar: true, min: 0, max: 0.5 }, { id: 'siguelineas.kd', ajustar: false, min: 0, max: 1 }]))
    .toEqual({ ok: true, parametros: [{ id: 'siguelineas.kp', grupo: 'siguelineas', nombre: 'kp', valor: 0.08, entero: false, min: 0, max: 0.5 }] });
  const vel = { ...ajustable('VEL', 100, 50, 200), id: 'siguelineas.VEL', entero: true };
  expect(paraElAgente([vel], [{ id: vel.id, ajustar: true, min: 50, max: 200 }]))
    .toEqual({ ok: true, parametros: [{ id: 'siguelineas.VEL', grupo: 'siguelineas', nombre: 'VEL', valor: 100, entero: true, min: 50, max: 200 }] });
});
