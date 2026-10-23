import { it, expect } from 'vitest';
import { compilar } from '../../src/compilador/compilar';
import { cargarNucleoDesdeDisco } from '../../src/compilador/nucleo-node';
import { Simulador } from '../../src/simulacion/simulador';
import type { Proyecto } from '../../src/proyecto/proyecto';

const PROYECTO: Proyecto = {
  nombre: 'seguidor',
  archivos: {
    'pines.h': `#pragma once
#define AIN1 16
#define AIN2 17
#define PWMA 18
#define BIN1 4
#define BIN2 5
#define PWMB 19
const uint8_t PINES_QTR[8] = {36, 39, 34, 35, 32, 33, 25, 26};
`,
    'seguidor.ino': `#include "pines.h"

float kp = 0.08;  // @ajustar siguelineas
float ki = 0;     // @ajustar siguelineas
float kd = 0.6;   // @ajustar siguelineas
long integral = 0;
int errorAnterior = 0;
unsigned long ultimoReporte = 0;

void setup() {
  Serial.begin(115200);
  prepararMotores();
  for (int i = 0; i < 8; i++) pinMode(PINES_QTR[i], INPUT);
}

int leerLinea() {
  long suma = 0, ponderada = 0;
  for (int i = 0; i < 8; i++) {
    int v = analogRead(PINES_QTR[i]);
    suma += v;
    ponderada += (long)v * i * 1000;
  }
  return suma > 0 ? ponderada / suma : 3500;
}

void loop() {
  int pos = leerLinea();
  int error = pos - 3500;
  integral = constrain(integral + error, -20000, 20000);
  float giro = kp * error + ki * integral + kd * (error - errorAnterior);
  errorAnterior = error;
  mover(150 + giro, 150 - giro);
  if (millis() - ultimoReporte > 200) {
    ultimoReporte = millis();
    Serial.printf("pos=%d giro=%.2f\\n", pos, giro);
  }
  delay(5);
}
`,
    'motores.ino': `void prepararMotores() {
  pinMode(AIN1, OUTPUT); pinMode(AIN2, OUTPUT);
  pinMode(BIN1, OUTPUT); pinMode(BIN2, OUTPUT);
}

void motor(int in1, int in2, int pwm, int velocidad) {
  velocidad = constrain(velocidad, -255, 255);
  digitalWrite(in1, velocidad >= 0 ? HIGH : LOW);
  digitalWrite(in2, velocidad >= 0 ? LOW : HIGH);
  analogWrite(pwm, abs(velocidad));
}

void mover(int izq, int der) {
  motor(AIN1, AIN2, PWMA, izq);
  motor(BIN1, BIN2, PWMB, der);
}
`,
  },
};

const mediana = (valores: number[]) => [...valores].sort((a, b) => a - b)[Math.floor(valores.length / 2)];

it('mide la compilación y la simulación', async () => {
  const nucleo = await cargarNucleoDesdeDisco();

  let inicio = performance.now();
  const primera = await compilar(PROYECTO, nucleo);
  const msPrimera = performance.now() - inicio;
  expect(primera.ok).toBe(true);
  if (!primera.ok) return;

  const enCaliente: number[] = [];
  for (let i = 0; i < 5; i++) {
    inicio = performance.now();
    const r = await compilar(PROYECTO, nucleo);
    enCaliente.push(performance.now() - inicio);
    expect(r.ok).toBe(true);
  }

  const sim = await Simulador.crear({ modulo: await WebAssembly.compile(primera.wasm), lectorAnalogico: pin => (pin === 34 || pin === 35 ? 3000 : 200) });
  inicio = performance.now();
  const resultado = sim.ejecutar(10_000_000);
  const msSimulacion = performance.now() - inicio;
  expect(resultado.motivo).toBe('tiempo');

  const tabla = {
    'Primera compilación (incluye cargar LLVM)': `${(msPrimera / 1000).toFixed(1)} s`,
    'Compilación en caliente (mediana de 5)': `${Math.round(mediana(enCaliente))} ms`,
    'Tamaño del .wasm': `${(primera.wasm.length / 1024).toFixed(1)} KB`,
    'Simular 10 s del robot (sin ritmo real)': `${Math.round(msSimulacion)} ms`,
  };
  console.table(tabla);

  expect(mediana(enCaliente)).toBeLessThan(10_000);
  expect(msSimulacion).toBeLessThan(10_000);
});
