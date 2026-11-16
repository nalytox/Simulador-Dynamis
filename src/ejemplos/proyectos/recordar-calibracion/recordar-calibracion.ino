// Recordar la calibración: la primera vez el robot calibra el sensor de línea girando sobre su eje
// y guarda lo que aprendió en su memoria (Preferences). Las veces siguientes lo lee de la memoria y
// parte de inmediato, sin calibrar: en la competencia ahorra tiempo.
// Si cambias el sensor de línea o la luz es otra, aprieta «Borrar la memoria» para calibrar de nuevo.
#include <QTRSensors.h>
#include <Preferences.h>
#include "pines.h"

QTRSensors qtr;
Preferences memoria;
uint16_t valores[8];

const int VELOCIDAD = 100;   // velocidad hacia adelante, de 0 a 255
const float KP = 0.025;      // cuánto corrige por cada unidad de error

unsigned long inicioRecorrido = 0;

// Mueve los motores: valores de -255 (atrás) a 255 (adelante).
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

// Calibra girando y guarda los mínimos y máximos de los 8 sensores en la memoria.
void calibrarYGuardar() {
  Serial.println("Calibrando...");
  girarCalibrando(1, 150);
  girarCalibrando(-1, 300);
  girarCalibrando(1, 150);
  motores(0, 0);
  // Cada arreglo tiene 8 números de 2 bytes: 16 bytes.
  memoria.putBytes("minimos", qtr.calibrationOn.minimum, 8 * sizeof(uint16_t));
  memoria.putBytes("maximos", qtr.calibrationOn.maximum, 8 * sizeof(uint16_t));
  Serial.println("Guardé la calibración en la memoria.");
}

// Lee la calibración guardada. Devuelve false si no hay una.
bool leerCalibracion() {
  if (memoria.getBytesLength("minimos") != 8 * sizeof(uint16_t)) return false;
  qtr.calibrate();  // una lectura, para que la librería prepare sus arreglos de calibración
  memoria.getBytes("minimos", qtr.calibrationOn.minimum, 8 * sizeof(uint16_t));
  memoria.getBytes("maximos", qtr.calibrationOn.maximum, 8 * sizeof(uint16_t));
  return true;
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
  ledcAttach(PIN_PWM_IZQ, 5000, 8);
  ledcAttach(PIN_PWM_DER, 5000, 8);
  qtr.setTypeAnalog();
  qtr.setSensorPins(PINES_QTR, 8);
  qtr.setEmitterPin(PIN_LEDON_QTR);

  memoria.begin("calibracion");
  if (leerCalibracion()) {
    Serial.println("Usé la calibración guardada.");
  } else {
    calibrarYGuardar();
  }
  memoria.end();
  inicioRecorrido = millis();
}

void loop() {
  uint16_t posicion = qtr.readLineBlack(valores);  // 0 a 7000; 3500 es el centro

  if (vioLaMeta()) {
    motores(VELOCIDAD, VELOCIDAD);  // avanza un poco para quedar dentro de la meta
    delay(300);
    motores(0, 0);
    Serial.println("¡Llegué a la meta!");
    while (true) delay(1000);
  }

  int error = (int)posicion - 3500;
  int correccion = KP * error;
  motores(VELOCIDAD + correccion, VELOCIDAD - correccion);
  delay(5);
}
