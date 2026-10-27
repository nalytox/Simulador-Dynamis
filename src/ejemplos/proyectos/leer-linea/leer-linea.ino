// Leer la línea: calibra el sensor de línea girando sobre su eje y después se mueve un poco
// a cada lado, mostrando dónde ve la línea (0 = bajo el sensor de la izquierda, 7000 = bajo el
// de la derecha, 3500 = al centro) y lo que mide cada uno de los 8 sensores.
#include <QTRSensors.h>
#include "pines.h"

QTRSensors qtr;
uint16_t valores[8];
unsigned long ultimoMensaje = 0;

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
  Serial.println("Listo. Ahora me muevo un poco a cada lado.");
}

void loop() {
  uint16_t posicion = qtr.readLineBlack(valores);

  // Medio segundo hacia un lado y medio segundo hacia el otro, despacio.
  if ((millis() / 500) % 2 == 0) motores(-60, 60);
  else motores(60, -60);

  if (millis() - ultimoMensaje >= 200) {
    ultimoMensaje = millis();
    Serial.printf("Línea en %u · sensores:", posicion);
    for (int i = 0; i < 8; i++) Serial.printf(" %u", valores[i]);
    Serial.println();
  }
}
