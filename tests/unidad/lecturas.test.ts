import { describe, it, expect } from 'vitest';
import {
  colorMuestra, posicionLinea, nombreColor, rumboGrados, textoInclinacion, porcentajeMotor, textoDistancia, textoTiempoRestante,
} from '../../src/ui/lecturas';

describe('lecturas para las tarjetas', () => {
  it('colorMuestra escala el canal más alto a 255 y da negro con poca luz', () => {
    expect(colorMuestra({ r: 960, g: 960, b: 960, c: 2880 })).toBe('#ffffff');
    expect(colorMuestra({ r: 0, g: 0, b: 0, c: 0 })).toBe('#000000');
    expect(colorMuestra({ r: 0, g: 625, b: 305, c: 930 })).toBe('#00ff7c');
    expect(colorMuestra({ r: 50, g: 50, b: 50, c: 150 })).toBe('#000000');
  });

  it('posicionLinea usa los umbrales de QTRSensors', () => {
    const blanco = 180;
    const negro = 3980;
    expect(posicionLinea([blanco, blanco, blanco, negro, negro, blanco, blanco, blanco])).toBe(3500);
    expect(posicionLinea(Array(8).fill(blanco))).toBeNull();
    expect(posicionLinea([negro, ...Array(7).fill(blanco)])).toBe(0);
  });

  it('nombreColor nombra lo que ve el sensor', () => {
    expect(nombreColor({ r: 960, g: 960, b: 960, c: 2880 })).toBe('Blanco');
    expect(nombreColor({ r: 0, g: 0, b: 0, c: 0 })).toBe('Negro');
    expect(nombreColor({ r: 0, g: 625, b: 305, c: 930 })).toBe('Verde');
    expect(nombreColor({ r: 400, g: 400, b: 400, c: 1200 })).toBe('Gris');
    expect(nombreColor({ r: 900, g: 100, b: 100, c: 1100 })).toBe('Rojo');
    expect(nombreColor({ r: 100, g: 100, b: 900, c: 1100 })).toBe('Azul');
  });

  it('textoInclinacion dice si sube o baja', () => {
    expect(textoInclinacion(-0.349)).toBe('Inclinación 20°, subiendo');
    expect(textoInclinacion(0.349)).toBe('Inclinación 20°, bajando');
    expect(textoInclinacion(0.01)).toBe('Plano');
  });

  it('rumboGrados va de 0 a 359', () => {
    expect(rumboGrados(-Math.PI / 2)).toBe(270);
    expect(rumboGrados(0)).toBe(0);
    expect(rumboGrados(2 * Math.PI - 0.001)).toBe(0);
  });

  it('porcentajeMotor: avance positivo, retroceso negativo, freno y libre en 0, nunca −0', () => {
    expect(porcentajeMotor({ duty: 0.5, modo: 'avance' })).toBe(50);
    expect(porcentajeMotor({ duty: -0.5, modo: 'retroceso' })).toBe(-50);
    expect(Object.is(porcentajeMotor({ duty: 0, modo: 'freno' }), -0)).toBe(false);
    expect(porcentajeMotor({ duty: -0.001, modo: 'retroceso' })).toBe(0);
    expect(Object.is(porcentajeMotor({ duty: -0.001, modo: 'retroceso' }), -0)).toBe(false);
  });

  it('textoDistancia y textoTiempoRestante', () => {
    expect(textoDistancia(8190)).toBe('Sin objetivo');
    expect(textoDistancia(250)).toBe('250 mm');
    expect(textoTiempoRestante(null)).toBe('Quedan 5:00');
    expect(textoTiempoRestante(61.5)).toBe('Quedan 3:58');
    expect(textoTiempoRestante(400)).toBe('Quedan 0:00');
  });
});
