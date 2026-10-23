// Subir la rampa: el acelerómetro del MPU6050 mide hacia dónde tira la gravedad. Cuando el robot
// se inclina, una parte de la gravedad aparece en el eje x, y con eso se calcula la inclinación.
// Al subir, el robot acelera para que no le falte fuerza; al bajar, frena un poco.
// Si el sensor de distancia ve algo muy cerca (el obstáculo), se detiene.
#include <Wire.h>
#include <QTRSensors.h>
#include <Adafruit_MPU6050.h>
#include <VL53L0X.h>
#include "pines.h"

QTRSensors qtr;
Adafruit_MPU6050 mpu;
VL53L0X distancia;
uint16_t valores[8];

const int VELOCIDAD = 90;            // velocidad en lo plano, de 0 a 255
const int VELOCIDAD_SUBIDA = 160;    // velocidad al subir
const int VELOCIDAD_BAJADA = 60;     // velocidad al bajar
const float KP = 0.03;               // cuánto corrige por cada unidad de error
const float INCLINACION_RAMPA = 8;   // desde cuántos grados se considera rampa
const int DISTANCIA_MINIMA = 80;     // mm: si hay algo más cerca, se detiene

unsigned long ultimoMensaje = 0;
unsigned long ultimaMedida = 0;
unsigned long inicioRecorrido = 0;

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

// La inclinación en grados: positiva con la nariz hacia arriba.
float inclinacion() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  return atan2(a.acceleration.x, a.acceleration.z) * 180 / PI;
}

// La meta tiene una barra atravesada: casi todos los sensores ven negro a la vez.
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
  qtr.setTypeAnalog();
  qtr.setSensorPins(PINES_QTR, 8);
  Wire.begin();
  if (!mpu.begin()) {
    Serial.println("No encuentro el MPU6050. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }
  distancia.setTimeout(500);
  if (!distancia.init()) {
    Serial.println("No encuentro el VL53L0X. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }
  distancia.startContinuous(20);  // una medida cada 20 ms

  Serial.println("Calibrando...");
  girarCalibrando(1, 150);
  girarCalibrando(-1, 300);
  girarCalibrando(1, 150);
  Serial.println("¡Listo! A seguir la línea.");
  inicioRecorrido = millis();
}

void loop() {
  uint16_t posicion = qtr.readLineBlack(valores);  // 0 a 7000; 3500 es el centro
  if (vioLaMeta()) {
    motores(VELOCIDAD, VELOCIDAD);
    delay(300);
    motores(0, 0);
    Serial.println("¡Llegué a la meta!");
    while (true) delay(1000);
  }

  if (millis() - ultimaMedida >= 25) {
    ultimaMedida = millis();
    if (distancia.readRangeContinuousMillimeters() < DISTANCIA_MINIMA) {
      motores(0, 0);
      Serial.println("Hay algo adelante: me detengo. (Para rodearlo, mira el ejemplo «Esquivar el obstáculo».)");
      while (true) delay(1000);
    }
  }

  float grados = inclinacion();
  int velocidad = VELOCIDAD;
  if (grados > INCLINACION_RAMPA) velocidad = VELOCIDAD_SUBIDA;
  else if (grados < -INCLINACION_RAMPA) velocidad = VELOCIDAD_BAJADA;

  int error = (int)posicion - 3500;
  int correccion = KP * error;
  motores(velocidad + correccion, velocidad - correccion);

  if (millis() - ultimoMensaje >= 300) {
    ultimoMensaje = millis();
    if (grados > INCLINACION_RAMPA) Serial.printf("Subiendo la rampa: %.0f°\n", grados);
    else if (grados < -INCLINACION_RAMPA) Serial.printf("Bajando la rampa: %.0f°\n", -grados);
  }
}
