// Cruzar cortes: un seguidor de línea que no se pierde cuando la línea tiene cortes.
// Si ningún sensor ve negro, sigue derecho un ratito: la línea debería volver a aparecer.
#include <QTRSensors.h>
#include "pines.h"

QTRSensors qtr;
uint16_t valores[8];

const int VELOCIDAD = 100;          // velocidad hacia adelante, de 0 a 255
const float KP = 0.03;              // cuánto corrige por cada unidad de error
const unsigned long ESPERA_CORTE = 400;  // cuánto sigue derecho sin ver línea, en ms

unsigned long ultimaVezQueVioLinea = 0;

// Mueve los motores: valores de -255 (atrás) a 255 (adelante).
void motores(int izq, int der) {
  digitalWrite(PIN_IN1_IZQ, izq >= 0);
  digitalWrite(PIN_IN2_IZQ, izq < 0);
  digitalWrite(PIN_IN1_DER, der >= 0);
  digitalWrite(PIN_IN2_DER, der < 0);
  analogWrite(PIN_PWM_IZQ, constrain(abs(izq), 0, 255));
  analogWrite(PIN_PWM_DER, constrain(abs(der), 0, 255));
}

// Gira sobre su eje mientras el sensor aprende qué es blanco y qué es negro.
void girarCalibrando(int sentido, unsigned long ms) {
  unsigned long inicio = millis();
  motores(-128 * sentido, 128 * sentido);
  while (millis() - inicio < ms) qtr.calibrate();
}

// ¿Algún sensor ve negro?
bool veLinea() {
  for (int i = 0; i < 8; i++) {
    if (valores[i] > 500) return true;
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_IN1_IZQ, OUTPUT);
  pinMode(PIN_IN2_IZQ, OUTPUT);
  pinMode(PIN_IN1_DER, OUTPUT);
  pinMode(PIN_IN2_DER, OUTPUT);
  qtr.setTypeAnalog();
  qtr.setSensorPins(PINES_QTR, 8);

  Serial.println("Calibrando...");
  girarCalibrando(1, 150);
  girarCalibrando(-1, 300);
  girarCalibrando(1, 150);
  Serial.println("¡Listo! A seguir la línea.");
  ultimaVezQueVioLinea = millis();
}

void loop() {
  uint16_t posicion = qtr.readLineBlack(valores);  // 0 a 7000; 3500 es el centro

  if (veLinea()) {
    ultimaVezQueVioLinea = millis();
    int error = (int)posicion - 3500;
    int correccion = KP * error;
    motores(VELOCIDAD + correccion, VELOCIDAD - correccion);
  } else if (millis() - ultimaVezQueVioLinea < ESPERA_CORTE) {
    motores(VELOCIDAD, VELOCIDAD);  // un corte: derecho hasta que vuelva la línea
  } else {
    motores(0, 0);                  // se perdió de verdad: mejor detenerse
    Serial.println("Perdí la línea.");
    while (true) delay(1000);
  }
}
