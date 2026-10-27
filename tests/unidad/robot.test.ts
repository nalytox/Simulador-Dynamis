import { describe, it, expect } from 'vitest';
import { ROBOT_POR_DEFECTO, ROBOT_POR_DEFECTO_ANTERIOR, esRobotPorDefectoAnterior, validarRobot, huellaRobot } from '../../src/robot/config';

describe('configuración del robot', () => {
  it('el robot por defecto es el Dynamis real: placa V2 sobre la base RGB', () => {
    expect(ROBOT_POR_DEFECTO).toEqual({
      chasis: { largo: 125, ancho: 180, alto: 117, xDelantero: 97 },
      ruedas: { diametro: 60, trocha: 160, x: 0 },
      ruedasLocas: { instalado: true, diametro: 55, x: 70, trocha: 160 },
      motores: { driver: 'TB6612', izq: { pwm: 4, in1: 16, in2: 17 }, der: { pwm: 19, in1: 5, in2: 18 }, stby: null, vMaxMmS: 600 },
      qtr: { pines: [36, 39, 34, 35, 32, 33, 25, 26], emisor: 27, x: 74, separacion: 8, altura: 7 },
      vl53l0x: { x: 82, y: 0, z: 20, yaw: 0, pitch: 0, canal: 2 },
      tcs34725: { x: 35, y: 22, z: 7, led: null, canal: 0 },
      tcs34725b: { instalado: true, x: 35, y: -22, z: 7, led: null, canal: 1 },
      mpu6050: { x: -15, y: 0, z: 45, orientacion: 'z-arriba-x-atras' },
    });
  });

  it('el robot por defecto es válido', () => expect(validarRobot(ROBOT_POR_DEFECTO)).toEqual([]));

  it('avisa si el robot es más grande que lo permitido o repite pines', () => {
    const r = structuredClone(ROBOT_POR_DEFECTO); r.chasis.largo = 230; r.motores.der.pwm = 4;
    expect(validarRobot(r).map(a => a.mensaje)).toEqual(expect.arrayContaining(['El robot mide 23 cm de largo; las bases permiten hasta 20 cm.', 'El pin 4 está usado dos veces.']));
  });

  it('avisa pines inexistentes, de solo entrada en motores y un QTR sin 8 pines', () => {
    const r = structuredClone(ROBOT_POR_DEFECTO); r.motores.izq.in1 = 50; r.motores.der.in2 = 35; r.qtr.pines = [36, 39];
    expect(validarRobot(r).map(a => a.mensaje)).toEqual(expect.arrayContaining(['El pin 50 no existe en el ESP32.', 'El pin 35 solo puede leer: no sirve como salida.', 'El QTRX-MD-08A necesita 8 pines.']));
  });

  it('avisa sensores fuera del chasis', () => {
    const r = structuredClone(ROBOT_POR_DEFECTO); r.tcs34725.x = 200;
    expect(validarRobot(r)).toEqual([{ campo: 'tcs34725', mensaje: 'El TCS34725 queda fuera del chasis.' }]);
    r.tcs34725.x = 35; r.qtr.x = 150;
    expect(validarRobot(r)).toEqual([{ campo: 'qtr', mensaje: 'El sensor de línea QTRX-MD-08A queda fuera del chasis.' }]);
  });

  it('el segundo TCS34725: mismo canal, LED repetido y fuera del chasis', () => {
    const r = structuredClone(ROBOT_POR_DEFECTO);
    r.tcs34725b.canal = 0;
    expect(validarRobot(r)).toEqual([{ campo: 'tcs34725b.canal', mensaje: 'Los dos TCS34725 usan la dirección 0x29: ponlos en canales distintos del multiplexor.' }]);
    r.tcs34725b.canal = 1; r.tcs34725b.x = 200; r.tcs34725b.led = 4;
    expect(validarRobot(r).map(a => a.mensaje)).toEqual(['El pin 4 está usado dos veces.', 'El segundo TCS34725 queda fuera del chasis.']);
    r.tcs34725b.instalado = false;
    expect(validarRobot(r)).toEqual([]);
  });

  it('el láser comparte 0x29 con los TCS34725: en el mismo canal (o los dos directo en el bus) chocan', () => {
    const choque = [{ campo: 'vl53l0x.canal', mensaje: 'El VL53L0X y un TCS34725 usan la dirección 0x29: ponlos en canales distintos del multiplexor.' }];
    const r = structuredClone(ROBOT_POR_DEFECTO);
    r.vl53l0x.canal = 1;
    expect(validarRobot(r)).toEqual(choque);
    r.tcs34725b.instalado = false;
    expect(validarRobot(r)).toEqual([]);
    r.vl53l0x.canal = null;
    expect(validarRobot(r)).toEqual([]);
    r.tcs34725.canal = null;
    expect(validarRobot(r)).toEqual(choque);
  });

  it('las ruedas locas: dentro del chasis y fuera del eje de las ruedas', () => {
    const r = structuredClone(ROBOT_POR_DEFECTO);
    r.ruedasLocas.x = 200;
    expect(validarRobot(r)).toEqual([{ campo: 'ruedasLocas.x', mensaje: 'Las ruedas locas quedan fuera del chasis.' }]);
    r.ruedasLocas.x = 0;
    expect(validarRobot(r)).toEqual([{ campo: 'ruedasLocas.x', mensaje: 'Las ruedas locas no pueden estar en el eje de las ruedas.' }]);
    r.ruedasLocas.instalado = false;
    expect(validarRobot(r)).toEqual([]);
  });

  it('huellaRobot rota el chasis', () => {
    const h = huellaRobot(100, 0, Math.PI / 2, ROBOT_POR_DEFECTO);
    expect(h[0].x).toBeCloseTo(10); expect(h[0].y).toBeCloseTo(97); // (97, 90) rotado 90° + (100, 0)
    expect(huellaRobot(0, 0, 0, ROBOT_POR_DEFECTO)).toEqual([{ x: 97, y: 90 }, { x: -28, y: 90 }, { x: -28, y: -90 }, { x: 97, y: -90 }]);
  });

  it('reconoce el robot por defecto anterior, aunque sus claves vengan en otro orden', () => {
    expect(esRobotPorDefectoAnterior(structuredClone(ROBOT_POR_DEFECTO_ANTERIOR))).toBe(true);
    const desordenado = Object.fromEntries(Object.entries(structuredClone(ROBOT_POR_DEFECTO_ANTERIOR)).reverse());
    expect(esRobotPorDefectoAnterior(desordenado)).toBe(true);
    const cambiado = structuredClone(ROBOT_POR_DEFECTO_ANTERIOR); cambiado.ruedas.trocha = 141;
    expect(esRobotPorDefectoAnterior(cambiado)).toBe(false);
    expect(esRobotPorDefectoAnterior(ROBOT_POR_DEFECTO)).toBe(false);
    expect(esRobotPorDefectoAnterior(undefined)).toBe(false);
  });
});
