import { describe, it, expect } from 'vitest';
import { BusI2C, type EntornoI2C } from '../../src/simulacion/i2c';
import { ROBOT_POR_DEFECTO, type ConfigRobot, type SensorColor } from '../../src/robot/config';

const MUX = 0x70;
const TCS = 0x29;
const COMANDO = 0x80;
const AUTOINCREMENTO = 0x20;
const ENABLE = 0x00, ATIME = 0x01, CONTROL = 0x0f, ID = 0x12, STATUS = 0x13, CDATAL = 0x14;
const PON = 0x01, AEN = 0x02, AIEN = 0x10;

/** Un entorno de prueba: el color depende del lado del sensor y se anotan las llamadas al modelo. */
function entorno(cuentas: (s: SensorColor) => number = s => (s.y > 0 ? 100 : 200)) {
  const llamadas: { sensor: SensorColor; integracionMs: number; ganancia: number; ledEncendido: boolean }[] = [];
  const avisos: string[] = [];
  const niveles = new Map<number, number>();
  let ahora = 0;
  const e: EntornoI2C = {
    leerColor: (sensor, integracionMs, ganancia, ledEncendido) => {
      llamadas.push({ sensor, integracionMs, ganancia, ledEncendido });
      const c = cuentas(sensor);
      return { r: c + 1, g: c + 2, b: c + 3, c };
    },
    nivelPin: pin => niveles.get(pin) ?? 0,
    ahoraUs: () => ahora,
    avisar: t => { if (!avisos.includes(t)) avisos.push(t); },
  };
  return { e, llamadas, avisos, niveles, pasar: (us: number) => { ahora += us; } };
}

const conMux = (): ConfigRobot => ({
  ...structuredClone(ROBOT_POR_DEFECTO),
  tcs34725: { ...ROBOT_POR_DEFECTO.tcs34725, canal: 0 },
  tcs34725b: { ...ROBOT_POR_DEFECTO.tcs34725b, instalado: true, canal: 1 },
});

const leerRegistro = (bus: BusI2C, reg: number, n = 1) => {
  bus.escribir(TCS, Uint8Array.of(COMANDO | AUTOINCREMENTO | reg));
  return bus.leer(TCS, n);
};
const encender = (bus: BusI2C) => bus.escribir(TCS, Uint8Array.of(COMANDO | ENABLE, PON | AEN));
/** c, r, g, b de una lectura de 8 bytes desde CDATAL (little endian). */
const rgbc = (b: Uint8Array | null) => (b ? [0, 2, 4, 6].map(i => b[i] | (b[i + 1] << 8)) : null);

describe('bus I2C simulado', () => {
  it('sin multiplexor: el TCS34725 responde en 0x29 con su ID y nadie responde en 0x70', () => {
    const { e } = entorno();
    const bus = new BusI2C(ROBOT_POR_DEFECTO, e);
    expect(bus.escribir(MUX, Uint8Array.of(1))).toBe(false);
    expect(bus.leer(MUX, 1)).toBeNull();
    expect(leerRegistro(bus, ID)).toEqual(Uint8Array.of(0x44));
    expect(bus.escribir(0x68, Uint8Array.of(0x3b))).toBe(false);
  });

  it('el multiplexor abre canales: cada TCS34725 responde solo en el suyo', () => {
    const { e, pasar } = entorno();
    const bus = new BusI2C(conMux(), e);
    expect(bus.leer(TCS, 1)).toBeNull();
    expect(bus.escribir(MUX, Uint8Array.of(1 << 0))).toBe(true);
    expect(bus.leer(MUX, 1)).toEqual(Uint8Array.of(1));
    encender(bus);
    bus.escribir(MUX, Uint8Array.of(1 << 1));
    encender(bus);
    pasar(10_000);
    expect(rgbc(leerRegistro(bus, CDATAL, 8))).toEqual([100, 101, 102, 103]);
    bus.escribir(MUX, Uint8Array.of(1 << 0));
    expect(rgbc(leerRegistro(bus, CDATAL, 8))).toEqual([200, 201, 202, 203]);
    bus.escribir(MUX, Uint8Array.of(0));
    expect(bus.escribir(TCS, Uint8Array.of(COMANDO | ID))).toBe(false);
  });

  it('apagado o antes de terminar una integración, los datos son 0 y STATUS no tiene AVALID', () => {
    const { e, pasar, llamadas } = entorno();
    const bus = new BusI2C(ROBOT_POR_DEFECTO, e);
    expect(rgbc(leerRegistro(bus, CDATAL, 8))).toEqual([0, 0, 0, 0]);
    encender(bus);
    pasar(2_000);
    expect(leerRegistro(bus, STATUS)).toEqual(Uint8Array.of(0));
    expect(rgbc(leerRegistro(bus, CDATAL, 8))).toEqual([0, 0, 0, 0]);
    pasar(1_000);
    expect(leerRegistro(bus, STATUS)).toEqual(Uint8Array.of(1));
    expect(rgbc(leerRegistro(bus, CDATAL, 8))).toEqual([200, 201, 202, 203]);
    // Una lectura de 8 bytes es una sola medida.
    expect(llamadas).toHaveLength(1);
  });

  it('ATIME y CONTROL eligen la integración y la ganancia; la cuenta se satura como en el chip', () => {
    const { e, pasar, llamadas } = entorno(() => 50_000);
    const bus = new BusI2C(ROBOT_POR_DEFECTO, e);
    bus.escribir(TCS, Uint8Array.of(COMANDO | ATIME, 0xf6));
    bus.escribir(TCS, Uint8Array.of(COMANDO | CONTROL, 0x02));
    encender(bus);
    pasar(30_000);
    expect(rgbc(leerRegistro(bus, CDATAL, 8))).toEqual([10240, 10240, 10240, 10240]);
    expect(llamadas[0]).toMatchObject({ integracionMs: 24, ganancia: 16 });
    expect(leerRegistro(bus, ATIME, 1)).toEqual(Uint8Array.of(0xf6));
  });

  it('el LED sigue al pin INT (apagado con AIEN) o al pin que lo maneja', () => {
    const { e, pasar, llamadas, niveles } = entorno();
    const robot = structuredClone(ROBOT_POR_DEFECTO);
    const bus = new BusI2C(robot, e);
    encender(bus);
    pasar(3_000);
    leerRegistro(bus, CDATAL, 8);
    bus.escribir(TCS, Uint8Array.of(COMANDO | ENABLE, PON | AEN | AIEN));
    pasar(3_000);
    leerRegistro(bus, CDATAL, 8);
    robot.tcs34725.led = 14;
    const conPin = new BusI2C(robot, e);
    encender(conPin);
    pasar(3_000);
    leerRegistro(conPin, CDATAL, 8);
    niveles.set(14, 1);
    pasar(3_000);
    leerRegistro(conPin, CDATAL, 8);
    expect(llamadas.map(l => l.ledEncendido)).toEqual([true, false, false, true]);
  });

  it('dos canales abiertos a la vez: los dos escuchan, se lee el primero y se avisa', () => {
    const { e, pasar, avisos } = entorno();
    const bus = new BusI2C(conMux(), e);
    bus.escribir(MUX, Uint8Array.of(0b11));
    encender(bus);
    pasar(3_000);
    expect(rgbc(leerRegistro(bus, CDATAL, 8))).toEqual([200, 201, 202, 203]);
    expect(avisos).toEqual(['Dos TCS34725 responden a la vez en 0x29: abre un solo canal del multiplexor.']);
    bus.escribir(MUX, Uint8Array.of(0b10));
    expect(rgbc(leerRegistro(bus, CDATAL, 8))).toEqual([100, 101, 102, 103]);
  });

  it('el ID y los datos no se pueden escribir, y la función especial borra la interrupción sin mover el puntero', () => {
    const { e } = entorno();
    const bus = new BusI2C(ROBOT_POR_DEFECTO, e);
    bus.escribir(TCS, Uint8Array.of(COMANDO | ID, 0x00));
    expect(leerRegistro(bus, ID)).toEqual(Uint8Array.of(0x44));
    bus.escribir(TCS, Uint8Array.of(COMANDO | ID));
    expect(bus.escribir(TCS, Uint8Array.of(COMANDO | 0x60 | 0x06))).toBe(true);
    expect(bus.leer(TCS, 1)).toEqual(Uint8Array.of(0x44));
  });

  it('los registros guardan la medida durante un ciclo de integración', () => {
    let cuenta = 100;
    const { e, pasar, llamadas } = entorno(() => cuenta++);
    const bus = new BusI2C(ROBOT_POR_DEFECTO, e);
    encender(bus);
    pasar(3_000);
    const canales = () => [CDATAL, CDATAL + 2, CDATAL + 4, CDATAL + 6].map(reg => leerRegistro(bus, reg, 2)![0]);
    expect(canales()).toEqual([100, 101, 102, 103]);
    pasar(2_000);
    expect(canales()).toEqual([100, 101, 102, 103]);
    pasar(1_000);
    expect(canales()).toEqual([101, 102, 103, 104]);
    expect(llamadas).toHaveLength(2);
  });

  it('si nadie responde, avisa qué falta según la dirección', () => {
    const sinMux = entorno();
    const bus = new BusI2C(ROBOT_POR_DEFECTO, sinMux.e);
    bus.escribir(MUX, Uint8Array.of(1));
    bus.leer(0x68, 6);
    expect(sinMux.avisos).toEqual([
      'Nadie respondió en 0x70: tu robot no tiene multiplexor. Ponle a cada TCS34725 su canal en «Mi robot».',
      'Nadie respondió en 0x68: por I2C directo el simulador solo tiene el multiplexor TCA9548A y los TCS34725. Para los demás sensores usa sus librerías.',
    ]);
    const conCanales = entorno();
    new BusI2C(conMux(), conCanales.e).leer(TCS, 1);
    expect(conCanales.avisos).toEqual(['Nadie respondió en 0x29: abre el canal del multiplexor donde está el TCS34725.']);
  });
});
