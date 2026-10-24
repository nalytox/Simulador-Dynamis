import { describe, it, expect } from 'vitest';
import { ROBOT_POR_DEFECTO, validarRobot, huellaRobot } from '../../src/robot/config';

describe('configuración del robot', () => {
  it('el robot por defecto es válido', () => expect(validarRobot(ROBOT_POR_DEFECTO)).toEqual([]));
  it('avisa si el robot es más grande que lo permitido o repite pines', () => {
    const r = structuredClone(ROBOT_POR_DEFECTO); r.chasis.largo = 230; r.motores.der.pwm = 18;
    expect(validarRobot(r).map(a => a.mensaje)).toEqual(expect.arrayContaining(['El robot mide 23 cm de largo; las bases permiten hasta 20 cm.', 'El pin 18 está usado dos veces.']));
  });
  it('avisa pines inexistentes, de solo entrada en motores y un QTR sin 8 pines', () => {
    const r = structuredClone(ROBOT_POR_DEFECTO); r.motores.izq.in1 = 50; r.motores.der.in2 = 35; r.qtr.pines = [36, 39];
    expect(validarRobot(r).map(a => a.mensaje)).toEqual(expect.arrayContaining(['El pin 50 no existe en el ESP32.', 'El pin 35 solo puede leer: no sirve como salida.', 'El QTR-MX-8A necesita 8 pines.']));
  });
  it('avisa sensores fuera del chasis', () => {
    const r = structuredClone(ROBOT_POR_DEFECTO); r.tcs34725.x = 200;
    expect(validarRobot(r)).toEqual([{ campo: 'tcs34725', mensaje: 'El TCS34725 queda fuera del chasis.' }]);
  });
  it('el segundo TCS34725: misma dirección sin multiplexor, LED repetido y fuera del chasis', () => {
    const r = structuredClone(ROBOT_POR_DEFECTO);
    r.tcs34725b.instalado = true;
    expect(validarRobot(r)).toEqual([{ campo: 'tcs34725b.canal', mensaje: 'Los dos TCS34725 usan la dirección 0x29: ponlos en canales distintos del multiplexor.' }]);
    r.tcs34725.canal = 0; r.tcs34725b.canal = 1;
    expect(validarRobot(r)).toEqual([]);
    r.tcs34725b.x = 200; r.tcs34725b.led = 4;
    expect(validarRobot(r).map(a => a.mensaje)).toEqual(['El pin 4 está usado dos veces.', 'El segundo TCS34725 queda fuera del chasis.']);
    r.tcs34725b.instalado = false;
    expect(validarRobot(r)).toEqual([]);
  });
  it('huellaRobot rota el chasis', () => {
    const h = huellaRobot(100, 0, Math.PI / 2, ROBOT_POR_DEFECTO);
    expect(h[0].x).toBeCloseTo(34); expect(h[0].y).toBeCloseTo(96); // (96, 66) rotado 90° + (100, 0)
    expect(huellaRobot(0, 0, 0, ROBOT_POR_DEFECTO)).toEqual([{ x: 96, y: 66 }, { x: -60, y: 66 }, { x: -60, y: -66 }, { x: 96, y: -66 }]);
  });
});
