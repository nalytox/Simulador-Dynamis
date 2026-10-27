import { it, expect } from 'vitest';
import { AVISO_ROBOT_ANTERIOR, CAMPOS_ROBOT, conCampo, escribirRobot, leerCampo, leerRobot, migrarRobotGuardado, normalizarRobot } from '../../src/robot/archivo';
import { ROBOT_POR_DEFECTO, ROBOT_POR_DEFECTO_ANTERIOR, validarRobot } from '../../src/robot/config';

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
    if (campo.tipo === 'si-no') expect(typeof valor, campo.ruta).toBe('boolean');
    if (campo.tipo === 'opcion') expect(campo.opciones?.map(o => o.valor), campo.ruta).toContain(valor);
  }
  expect(CAMPOS_ROBOT.filter(c => c.ruta.startsWith('qtr.pines.')).map(c => c.ruta)).toEqual(
    ['qtr.pines.0', 'qtr.pines.1', 'qtr.pines.2', 'qtr.pines.3', 'qtr.pines.4', 'qtr.pines.5', 'qtr.pines.6', 'qtr.pines.7']);
  expect(new Set(CAMPOS_ROBOT.map(c => c.grupo))).toEqual(new Set(['Medidas', 'Sensores', 'Pines']));
  expect(leerCampo(ROBOT_POR_DEFECTO, 'ruedas.trocha')).toBe(160);
  expect(leerCampo(ROBOT_POR_DEFECTO, 'motores.izq.invertir')).toBe(false);
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

it('un robot.json antiguo (el robot por defecto anterior) se carga: lo que falta se completa y se avisa', () => {
  const r = normalizarRobot(JSON.parse(JSON.stringify(ROBOT_POR_DEFECTO_ANTERIOR)));
  expect(r).toEqual({ ok: true, robot: { ...structuredClone(ROBOT_POR_DEFECTO_ANTERIOR),
    ruedasLocas: ROBOT_POR_DEFECTO.ruedasLocas,
    motores: { ...ROBOT_POR_DEFECTO_ANTERIOR.motores, vMaxMmS: 600 },
    vl53l0x: { ...ROBOT_POR_DEFECTO_ANTERIOR.vl53l0x, canal: 2 },
  }, avisos: [
    'Faltaba ruedasLocas: se usaron los valores del profe.',
    'Faltaba motores.vMaxMmS: se usó el valor del profe.',
    'Faltaba vl53l0x.canal: se usó el valor del profe.',
  ] });
});

it('un robot.json de antes del segundo TCS34725 y de los canales también se carga', () => {
  const { tcs34725b, ...sinSegundo } = structuredClone(ROBOT_POR_DEFECTO_ANTERIOR);
  const datos = { ...sinSegundo, tcs34725: { x: 40, y: -46, z: 5, led: null } };
  const r = normalizarRobot(JSON.parse(JSON.stringify(datos)));
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.robot.tcs34725).toEqual({ x: 40, y: -46, z: 5, led: null, canal: 0 });
  expect(r.robot.tcs34725b).toEqual(ROBOT_POR_DEFECTO.tcs34725b);
  expect(r.avisos).toEqual(expect.arrayContaining(['Faltaba tcs34725.canal: se usó el valor del profe.', 'Faltaba tcs34725b: se usaron los valores del profe.']));
  expect(tcs34725b.instalado).toBe(false);
});

it('la orientación del MPU6050: solo las que conoce el simulador', () => {
  const datos = copia() as unknown as Record<string, Record<string, unknown>>;
  datos.mpu6050.orientacion = 'z-abajo';
  expect(normalizarRobot(datos)).toEqual({ ok: false, errores: ['mpu6050.orientacion debe ser "z-arriba-x-adelante" o "z-arriba-x-atras".'] });
  expect(conCampo(copia(), 'mpu6050.orientacion', 'z-arriba-x-adelante').mpu6050.orientacion).toBe('z-arriba-x-adelante');
  expect(conCampo(copia(), 'mpu6050.orientacion', 'otra').mpu6050.orientacion).toBe('z-arriba-x-atras');
  const campo = CAMPOS_ROBOT.find(c => c.ruta === 'mpu6050.orientacion');
  expect(campo?.tipo).toBe('opcion');
  expect(campo?.opciones?.map(o => o.valor)).toEqual(['z-arriba-x-adelante', 'z-arriba-x-atras']);
});

it('ruedas locas, velocidad máxima y canal del láser: tipos, rangos y campos', () => {
  const datos = copia() as unknown as Record<string, Record<string, unknown>>;
  datos.ruedasLocas.diametro = 0;
  datos.motores.vMaxMmS = -1;
  datos.vl53l0x.canal = 8;
  expect(normalizarRobot(datos)).toEqual({ ok: false, errores: [
    'ruedasLocas.diametro debe ser un número mayor que 0.',
    'motores.vMaxMmS debe ser un número mayor que 0.',
    'vl53l0x.canal debe ser un canal del multiplexor (0 a 7) o null (sin multiplexor).',
  ] });
  const rutas = CAMPOS_ROBOT.map(c => c.ruta);
  expect(rutas).toEqual(expect.arrayContaining(['ruedasLocas.instalado', 'ruedasLocas.diametro', 'ruedasLocas.x', 'ruedasLocas.trocha', 'motores.vMaxMmS', 'vl53l0x.canal', 'mpu6050.orientacion']));
  expect(conCampo(copia(), 'vl53l0x.canal', null).vl53l0x.canal).toBeNull();
  expect(conCampo(copia(), 'motores.vMaxMmS', 450).motores.vMaxMmS).toBe(450);
  expect(conCampo(copia(), 'ruedasLocas.instalado', false).ruedasLocas.instalado).toBe(false);
});

it('canales del multiplexor y el segundo TCS34725: tipos y rangos', () => {
  const datos = copia() as unknown as Record<string, Record<string, unknown>>;
  datos.tcs34725.canal = 9;
  datos.tcs34725b.instalado = 'si';
  datos.tcs34725b.canal = 1.5;
  expect(normalizarRobot(datos)).toEqual({ ok: false, errores: [
    'tcs34725.canal debe ser un canal del multiplexor (0 a 7) o null (sin multiplexor).',
    'tcs34725b.instalado debe ser true o false.',
    'tcs34725b.canal debe ser un canal del multiplexor (0 a 7) o null (sin multiplexor).',
  ] });
  const r = copia();
  expect(conCampo(r, 'tcs34725.canal', 9).tcs34725.canal).toBe(7);
  expect(conCampo(conCampo(r, 'tcs34725.canal', 2), 'tcs34725.canal', null).tcs34725.canal).toBeNull();
  expect(conCampo(r, 'tcs34725b.instalado', true).tcs34725b.instalado).toBe(true);
  expect(CAMPOS_ROBOT.filter(c => c.ruta.startsWith('tcs34725')).map(c => [c.ruta, c.tipo])).toEqual([
    ['tcs34725.x', 'numero'], ['tcs34725.y', 'numero'], ['tcs34725.z', 'numero'],
    ['tcs34725b.instalado', 'si-no'], ['tcs34725b.x', 'numero'], ['tcs34725b.y', 'numero'], ['tcs34725b.z', 'numero'],
    ['tcs34725.led', 'pin-opcional'], ['tcs34725.canal', 'canal'], ['tcs34725b.led', 'pin-opcional'], ['tcs34725b.canal', 'canal'],
  ]);
});

it('el robot guardado igual al robot por defecto anterior pasa a ser el Dynamis V2', () => {
  expect(migrarRobotGuardado(structuredClone(ROBOT_POR_DEFECTO_ANTERIOR))).toEqual({ robot: ROBOT_POR_DEFECTO, actualizado: true, aviso: null });
});

it('el robot guardado con cambios del estudiante se queda como está y se avisa', () => {
  const cambiado = structuredClone(ROBOT_POR_DEFECTO_ANTERIOR);
  cambiado.ruedas.trocha = 120;
  const m = migrarRobotGuardado(cambiado)!;
  expect(m.actualizado).toBe(false);
  expect(m.aviso).toBe(AVISO_ROBOT_ANTERIOR);
  expect(m.robot.ruedas).toEqual({ diametro: 42, trocha: 120, x: 0 });
  expect(m.robot.chasis).toEqual(ROBOT_POR_DEFECTO_ANTERIOR.chasis);
  // Lo que le faltaba toma el valor por defecto.
  expect(m.robot.ruedasLocas).toEqual(ROBOT_POR_DEFECTO.ruedasLocas);
  expect(m.robot.vl53l0x.canal).toBe(2);
});

it('un robot guardado ya al día se usa tal cual, sin aviso; nada guardado o algo que no es un robot da null', () => {
  const r = conCampo(copia(), 'ruedas.trocha', 150);
  expect(migrarRobotGuardado(r)).toEqual({ robot: r, actualizado: false, aviso: null });
  expect(migrarRobotGuardado(undefined)).toBeNull();
  expect(migrarRobotGuardado({ nombre: 'pista' })).toBeNull();
});
