import { it, expect } from 'vitest';
import { CAMPOS_ROBOT, conCampo, escribirRobot, leerCampo, leerRobot, normalizarRobot } from '../../src/robot/archivo';
import { ROBOT_POR_DEFECTO, validarRobot } from '../../src/robot/config';

const copia = () => structuredClone(ROBOT_POR_DEFECTO);

it('escribirRobot y leerRobot son inversos', () => {
  const r = conCampo(conCampo(copia(), 'ruedas.trocha', 120), 'motores.izq.invertir', true);
  expect(leerRobot(escribirRobot(r))).toEqual({ ok: true, robot: r, avisos: [] });
  expect(escribirRobot(r)).toContain('\n  "chasis"');
});

it('un robot incompleto se completa con los valores del profe y lo informa', () => {
  const { chasis, ...sinChasis } = copia();
  const datos = { ...sinChasis, chasis: { largo: chasis.largo, ancho: 150, xDelantero: chasis.xDelantero }, vl53l0x: undefined };
  const r = normalizarRobot(JSON.parse(JSON.stringify(datos)));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.robot.chasis).toEqual({ ...chasis, ancho: 150 });
  expect(r.robot.vl53l0x).toEqual(ROBOT_POR_DEFECTO.vl53l0x);
  expect(r.avisos).toEqual(['Faltaba chasis.alto: se usó el valor del profe.', 'Faltaba vl53l0x: se usaron los valores del profe.']);
});

it('tipos equivocados y pines no enteros son errores', () => {
  const datos = copia() as unknown as Record<string, Record<string, unknown>>;
  datos.chasis.largo = 'grande';
  datos.ruedas.diametro = -4;
  (datos.motores.izq as Record<string, unknown>).pwm = 18.5;
  datos.motores.stby = 'no';
  datos.qtr.pines = [36, 39, 'x'];
  datos.motores.driver = 'L298N';
  const r = normalizarRobot(datos);
  expect(r).toEqual({ ok: false, errores: [
    'chasis.largo debe ser un número.',
    'ruedas.diametro debe ser un número mayor que 0.',
    'motores.driver debe ser "TB6612".',
    'motores.izq.pwm debe ser un pin (un número entero).',
    'motores.stby debe ser un pin o null (sin conectar).',
    'qtr.pines debe ser una lista de pines (números enteros).',
  ] });
  expect(normalizarRobot({ ...copia(), chasis: 'grande' })).toEqual({ ok: false, errores: ['chasis debe ser un grupo de valores entre { }.'] });
});

it('un archivo que no es un robot', () => {
  expect(leerRobot('[1,2]')).toEqual({ ok: false, errores: ['El archivo no es un robot válido.'] });
  expect(leerRobot('{"name":"x","version":"1.0.0"}')).toEqual({ ok: false, errores: ['El archivo no es un robot válido.'] });
  expect(leerRobot('hola')).toEqual({ ok: false, errores: ['El archivo no es un robot válido (no es JSON).'] });
  expect(normalizarRobot(null)).toEqual({ ok: false, errores: ['El archivo no es un robot válido.'] });
});

it('cada campo de CAMPOS_ROBOT existe en ROBOT_POR_DEFECTO', () => {
  for (const campo of CAMPOS_ROBOT) {
    const valor = leerCampo(ROBOT_POR_DEFECTO, campo.ruta);
    expect(valor, campo.ruta).not.toBeUndefined();
    if (campo.tipo === 'numero' || campo.tipo === 'pin') expect(typeof valor, campo.ruta).toBe('number');
    if (campo.tipo === 'si-no') expect(valor, campo.ruta).toBe(false);
  }
  expect(CAMPOS_ROBOT.filter(c => c.ruta.startsWith('qtr.pines.')).map(c => c.ruta)).toEqual(
    ['qtr.pines.0', 'qtr.pines.1', 'qtr.pines.2', 'qtr.pines.3', 'qtr.pines.4', 'qtr.pines.5', 'qtr.pines.6', 'qtr.pines.7']);
  expect(new Set(CAMPOS_ROBOT.map(c => c.grupo))).toEqual(new Set(['Medidas', 'Sensores', 'Pines']));
  expect(leerCampo(ROBOT_POR_DEFECTO, 'ruedas.trocha')).toBe(140);
  expect(leerCampo(ROBOT_POR_DEFECTO, 'motores.stby')).toBeNull();
});

it('conCampo cambia una copia y acota al rango', () => {
  const r = copia();
  const otro = conCampo(r, 'qtr.pines.3', 99);
  expect(otro.qtr.pines[3]).toBe(39);
  expect(r).toEqual(ROBOT_POR_DEFECTO);
  expect(conCampo(r, 'motores.izq.pwm', 22.7).motores.izq.pwm).toBe(23);
  expect(conCampo(r, 'chasis.largo', -5).chasis.largo).toBeGreaterThan(0);
  expect(conCampo(r, 'motores.stby', null).motores.stby).toBeNull();
  expect(conCampo(r, 'tcs34725.led', 4).tcs34725.led).toBe(4);
  expect(conCampo(r, 'motores.der.invertir', true).motores.der.invertir).toBe(true);
});

it('validarRobot sigue avisando un pin repetido después de conCampo', () => {
  const r = conCampo(copia(), 'qtr.pines.1', 36);
  expect(validarRobot(r).map(a => a.mensaje)).toContain('El pin 36 está usado dos veces.');
});

it('el QTR necesita exactamente 8 pines, sin huecos', () => {
  const seis = { ...copia(), qtr: { ...copia().qtr, pines: [36, 39, 34, 35, 32, 33] } };
  expect(normalizarRobot(seis)).toEqual({ ok: false, errores: ['qtr.pines debe tener 8 pines, uno por sensor.'] });
  const conHueco = copia();
  delete (conHueco.qtr.pines as (number | undefined)[])[6];
  expect(normalizarRobot(conHueco).ok).toBe(false);
  expect(conCampo(copia(), 'qtr.pines.9', 3).qtr.pines).toEqual(ROBOT_POR_DEFECTO.qtr.pines);
});
