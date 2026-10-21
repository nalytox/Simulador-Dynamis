import { describe, it, expect } from 'vitest';
import { Pines } from '../../src/simulacion/pines';
import { pinesAMotores } from '../../src/simulacion/motores';
import { ROBOT_POR_DEFECTO } from '../../src/robot/config';

const M = ROBOT_POR_DEFECTO.motores; // izq: pwm 18, in1 16, in2 17 · der: pwm 19, in1 4, in2 5

function conDireccion(in1: number, in2: number, pwm?: number): Pines {
  const p = new Pines();
  for (const pin of [16, 17, 4, 5]) p.pinMode(pin, 0x03);
  p.digitalWrite(16, in1); p.digitalWrite(17, in2); p.digitalWrite(4, in1); p.digitalWrite(5, in2);
  if (pwm !== undefined) { p.analogWrite(18, pwm); p.analogWrite(19, pwm); }
  return p;
}

describe('driver TB6612', () => {
  it('IN1=1, IN2=0 avanza con el ciclo del PWM', () =>
    expect(pinesAMotores(conDireccion(1, 0, 255), M)).toEqual({ izq: { duty: 1, modo: 'avance' }, der: { duty: 1, modo: 'avance' } }));
  it('IN1=0, IN2=1 retrocede', () => {
    const m = pinesAMotores(conDireccion(0, 1, 128), M);
    expect(m.izq.modo).toBe('retroceso');
    expect(m.izq.duty).toBeCloseTo(-128 / 255);
  });
  it('IN1=IN2=1 frena e IN1=IN2=0 queda libre', () => {
    expect(pinesAMotores(conDireccion(1, 1, 255), M).izq).toEqual({ duty: 0, modo: 'freno' });
    expect(pinesAMotores(conDireccion(0, 0, 255), M).izq).toEqual({ duty: 0, modo: 'libre' });
  });
  it('invertir cambia el sentido', () =>
    expect(pinesAMotores(conDireccion(1, 0, 255), { ...M, der: { ...M.der, invertir: true } }).der).toEqual({ duty: -1, modo: 'retroceso' }));
  it('STBY en LOW deja los motores libres', () => {
    const p = conDireccion(1, 0, 255);
    p.pinMode(23, 0x03); p.digitalWrite(23, 0);
    expect(pinesAMotores(p, { ...M, stby: 23 })).toEqual({ izq: { duty: 0, modo: 'libre' }, der: { duty: 0, modo: 'libre' } });
    p.digitalWrite(23, 1);
    expect(pinesAMotores(p, { ...M, stby: 23 }).izq.modo).toBe('avance');
  });
  it('el PWM puede venir de ledcAttach y ledcWrite', () => {
    const p = conDireccion(1, 0);
    p.ledcAttach(18, 5000, 10); p.ledcWrite(18, 1023);
    expect(pinesAMotores(p, M).izq.duty).toBe(1);
  });
});
