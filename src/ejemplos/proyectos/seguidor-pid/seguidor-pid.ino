// Seguidor de línea con PID: corrige según el error de ahora (P), el que se fue acumulando (I)
// y qué tan rápido está cambiando (D). Prueba "Ajustar parámetros" para buscar los mejores valores.
#include <QTRSensors.h>
#include "pines.h"

QTRSensors qtr;
uint16_t valores[8];

const int VELOCIDAD = 120;   // velocidad hacia adelante, de 0 a 255 · @ajustar siguelineas 50..200
const float KP = 0.04;       // cuánto corrige por el error de ahora · @ajustar siguelineas 0..0.1
const float KI = 0.0001;     // cuánto corrige por el error acumulado · @ajustar siguelineas 0..0.001
const float KD = 0.3;        // cuánto frena los zigzags · @ajustar siguelineas 0..1

const unsigned long PERIODO_MS = 10;  // el PID se calcula cada 10 ms
float integral = 0;
int errorAnterior = 0;
unsigned long ultimoCalculo = 0;
unsigned long inicioRecorrido = 0;

// Mueve los motores: valores de -255 (atrás) a 255 (adelante). En el ESP32 el PWM se hace con
// ledcWrite, en los pines que setup() preparó con ledcAttach.
void motores(int izq, int der) {
  digitalWrite(PIN_IN1_IZQ, izq >= 0);
  digitalWrite(PIN_IN2_IZQ, izq < 0);
  digitalWrite(PIN_IN1_DER, der >= 0);
  digitalWrite(PIN_IN2_DER, der < 0);
  ledcWrite(PIN_PWM_IZQ, constrain(abs(izq), 0, 255));
  ledcWrite(PIN_PWM_DER, constrain(abs(der), 0, 255));
}

// Gira sobre su eje mientras el sensor aprende qué es blanco y qué es negro.
void girarCalibrando(int sentido, unsigned long ms) {
  unsigned long inicio = millis();
  motores(-128 * sentido, 128 * sentido);
  while (millis() - inicio < ms) qtr.calibrate();
}

// La meta tiene una barra atravesada: casi todos los sensores ven negro a la vez.
// La partida también tiene una, así que en el primer segundo y medio no cuenta.
bool vioLaMeta() {
  if (millis() - inicioRecorrido < 1500) return false;
  int negros = 0;
  for (int i = 0; i < 8; i++) {
    if (valores[i] > 600) negros++;
  }
  return negros >= 6;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_IN1_IZQ, OUTPUT);
  pinMode(PIN_IN2_IZQ, OUTPUT);
  pinMode(PIN_IN1_DER, OUTPUT);
  pinMode(PIN_IN2_DER, OUTPUT);
  ledcAttach(PIN_PWM_IZQ, 5000, 8);  // PWM de 5 kHz y 8 bits: de 0 a 255
  ledcAttach(PIN_PWM_DER, 5000, 8);
  qtr.setTypeAnalog();
  qtr.setSensorPins(PINES_QTR, 8);
  qtr.setEmitterPin(PIN_LEDON_QTR);  // la librería enciende los emisores al leer

  Serial.println("Calibrando...");
  girarCalibrando(1, 150);
  girarCalibrando(-1, 300);
  girarCalibrando(1, 150);
  motores(0, 0);
  Serial.println("¡Listo! A seguir la línea con PID.");
  inicioRecorrido = millis();
}

void loop() {
  if (millis() - ultimoCalculo < PERIODO_MS) return;
  ultimoCalculo = millis();

  uint16_t posicion = qtr.readLineBlack(valores);  // 0 a 7000; 3500 es el centro
  if (vioLaMeta()) {
    motores(VELOCIDAD, VELOCIDAD);  // avanza un poco para quedar dentro de la meta
    delay(300);
    motores(0, 0);
    Serial.println("¡Llegué a la meta!");
    while (true) delay(1000);
  }

  int error = (int)posicion - 3500;
  integral = constrain(integral + error, -20000, 20000);  // sin dejar que crezca para siempre
  int derivada = error - errorAnterior;
  errorAnterior = error;

  int correccion = KP * error + KI * integral + KD * derivada;
  motores(VELOCIDAD + correccion, VELOCIDAD - correccion);
}
