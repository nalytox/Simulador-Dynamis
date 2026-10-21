import { describe, it, expect } from 'vitest';
import { Pines } from '../../src/simulacion/pines';

describe('Pines del ESP32', () => {
  it('analogWrite recorta, avisa y normaliza según la resolución', () => {
    const p = new Pines();
    p.analogWrite(18, 300);
    expect(p.nivel(18)).toBe(1);
    expect(p.avisos).toContainEqual({ pin: 18, mensaje: 'analogWrite(18, 300) está fuera de rango: con 8 bits el máximo es 255.' });
    p.analogWriteResolution(18, 10); p.analogWrite(18, 512);
    expect(p.nivel(18)).toBeCloseTo(512 / 1023);
  });
  it('digitalWrite sin pinMode no mueve el pin y avisa una sola vez', () => {
    const p = new Pines(); p.digitalWrite(16, 1); p.digitalWrite(16, 1);
    expect(p.nivel(16)).toBe(0);
    expect(p.avisos).toEqual([{ pin: 16, mensaje: 'Usa pinMode(16, OUTPUT) antes de digitalWrite(16, …).' }]);
  });
  it('los pines 34 a 39 solo leen y los inexistentes avisan', () => {
    const p = new Pines(); p.pinMode(34, 0x03); p.digitalWrite(34, 1); p.digitalWrite(50, 1);
    expect(p.nivel(34)).toBe(0);
    expect(p.avisos.map(a => a.mensaje)).toEqual(['El pin 34 solo puede leer: no sirve como salida.', 'El pin 50 no existe en el ESP32.']);
  });
  it('digitalRead: una salida devuelve lo escrito; INPUT_PULLUP lee 1', () => {
    const p = new Pines(); p.pinMode(16, 0x03); p.digitalWrite(16, 1); p.pinMode(4, 0x05);
    expect([p.digitalRead(16), p.digitalRead(4), p.digitalRead(5)]).toEqual([1, 1, 0]);
  });
  it('ledcWrite sin ledcAttach no hace nada y avisa', () => {
    const p = new Pines();
    expect(p.ledcWrite(21, 512)).toBe(false);
    expect(p.nivel(21)).toBe(0);
    expect(p.avisos).toEqual([{ pin: 21, mensaje: 'Usa ledcAttach(21, frecuencia, bits) antes de ledcWrite(21, …).' }]);
  });
  it('ledcAttach y ledcWrite normalizan con los bits elegidos; digitalWrite quita el PWM', () => {
    const p = new Pines();
    expect(p.ledcAttach(21, 5000, 10)).toBe(true);
    p.ledcWrite(21, 512);
    expect(p.nivel(21)).toBeCloseTo(512 / 1023);
    p.pinMode(21, 0x03); p.digitalWrite(21, 0);
    expect(p.nivel(21)).toBe(0);
  });
});
