import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import { compilar, type ArchivosNucleo } from '../../src/compilador/compilar';

/** Lo que cada fragmento de «¿Cómo lo uso?» da por declarado. */
const DECLARACIONES: Record<string, string> = {
  's-qtr': '#include <QTRSensors.h>\nQTRSensors qtr;',
  's-tof': '#include <Adafruit_VL53L0X.h>\nAdafruit_VL53L0X distancia;',
  's-tcs': '#include <Adafruit_TCS34725.h>\nAdafruit_TCS34725 tcs;',
  's-mpu': '#include <Wire.h>\n#include <MPU6050_light.h>\nMPU6050 mpu(Wire);',
  's-mot': 'const int PWM_IZQ = 18;',
};

const desescapar = (html: string) => html.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

let nucleo: ArchivosNucleo;
beforeAll(async () => { nucleo = await cargarNucleoDesdeDisco(); });

describe('fragmentos de las tarjetas de sensores', { timeout: 120_000 }, () => {
  it('cada «¿Cómo lo uso?» compila con las librerías del núcleo', async () => {
    const html = readFileSync('index.html', 'utf8');
    const fragmentos = [...html.matchAll(/<pre id="(s-[a-z]+)" hidden>([\s\S]*?)<\/pre>/g)].map(m => ({ id: m[1], codigo: desescapar(m[2]) }));
    expect(fragmentos.map(f => f.id)).toEqual(Object.keys(DECLARACIONES));
    for (const { id, codigo } of fragmentos) {
      const sketch = `${DECLARACIONES[id]}\nvoid setup() {\n${codigo}\n}\nvoid loop() {}\n`;
      const r = await compilar({ nombre: 'f', archivos: { 'f.ino': sketch } }, nucleo);
      expect(r.ok ? [] : r.diagnosticos.filter(d => d.severidad === 'error').map(d => d.mensaje), id).toEqual([]);
    }
  });
});
