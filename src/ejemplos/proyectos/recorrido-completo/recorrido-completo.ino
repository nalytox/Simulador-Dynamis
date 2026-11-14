// Recorrido completo: un programa de competencia que resuelve todos los casos de una pista de rescate.
// Cada caso vive en su pestaña:
//   linea.h      seguir la línea con PID, la línea blanca sobre fondo negro, los cortes y la rampa
//   desafios.h   leer el indicador F2 y resolver el cuadrado F1
//   cruces.h     cruces, uniones en T, giros en L, marcas verdes (con la vuelta en U) y la meta
//   obstaculo.h  ver el obstáculo con el láser y rodearlo
// Los números marcados con @ajustar se pueden entrenar con «Ajustar parámetros».
#include <Wire.h>
#include <QTRSensors.h>
#include <Adafruit_TCS34725.h>
#include <Adafruit_VL53L0X.h>
#include <MPU6050_light.h>
#include "pines.h"

QTRSensors qtr;
uint16_t valores[8];
// 2,4 ms de integración: una lectura rápida, para no frenar el robot en los cruces.
Adafruit_TCS34725 colorIzq(TCS34725_INTEGRATIONTIME_2_4MS, TCS34725_GAIN_4X);
Adafruit_TCS34725 colorDer(TCS34725_INTEGRATIONTIME_2_4MS, TCS34725_GAIN_4X);
Adafruit_VL53L0X laser;
MPU6050 mpu(Wire);

// ----- Lo que se puede entrenar -----
const int VELOCIDAD = 110;           // velocidad en lo plano, de 0 a 255 · @ajustar siguelineas 60..200
const float KP = 0.035;              // cuánto corrige por el error de ahora · @ajustar siguelineas 0..0.1
const float KI = 0.0;                // cuánto corrige por el error acumulado · @ajustar siguelineas 0..0.001
const float KD = 0.25;               // cuánto frena los zigzags · @ajustar siguelineas 0..1
const int VELOCIDAD_MINIMA = 70;     // nunca más lento: con menos fuerza no pasa los baches · @ajustar siguelineas 30..150
const int UMBRAL_NEGRO = 700;        // desde cuánto un sensor ve negro, de 0 a 1000 · @ajustar siguelineas 300..900
const int ESPERA_CORTE = 500;        // ms derecho cuando no ve la línea (un corte) · @ajustar siguelineas 100..1000
const int VELOCIDAD_SUBIDA = 170;    // velocidad subiendo una rampa · @ajustar giroscopio 80..255
const int VELOCIDAD_BAJADA = 70;     // velocidad bajando una rampa · @ajustar giroscopio 30..150
const float PITCH_RAMPA = 8;         // grados de inclinación desde los que está en una rampa · @ajustar giroscopio 3..15
const int AVANCE_AL_CENTRO = 330;    // ms para llevar las ruedas al centro de un cruce · @ajustar recorrido 100..600
const int GIRO_MINIMO = 50;          // grados que gira antes de buscar la otra línea · @ajustar recorrido 20..80
const int DISTANCIA_OBSTACULO = 50;  // mm a los que ve el obstáculo y lo rodea · @ajustar distancia 30..150
const int RODEO_MS = 570;            // ms apartándose del obstáculo antes de volver · @ajustar distancia 300..1200

// ----- Fijos -----
const int VELOCIDAD_CRUCE = 90;      // velocidad al pasar por un cruce (AVANCE_AL_CENTRO cuenta con ella)
const int VELOCIDAD_GIRO = 110;      // velocidad de cada rueda al girar sobre su eje
const unsigned long PERIODO_MS = 10; // el PID se calcula cada 10 ms

// Mueve los motores: valores de -255 (atrás) a 255 (adelante).
void motores(int izq, int der) {
  digitalWrite(PIN_IN1_IZQ, izq >= 0);
  digitalWrite(PIN_IN2_IZQ, izq < 0);
  digitalWrite(PIN_IN1_DER, der >= 0);
  digitalWrite(PIN_IN2_DER, der < 0);
  ledcWrite(PIN_PWM_IZQ, constrain(abs(izq), 0, 255));
  ledcWrite(PIN_PWM_DER, constrain(abs(der), 0, 255));
}

// Abre un canal del multiplexor TCA9548A: desde ahí el bus I2C llega al sensor de ese canal.
void abrirCanal(uint8_t canal) {
  Wire.beginTransmission(DIRECCION_MUX);
  Wire.write(1 << canal);
  Wire.endTransmission();
}

#include "linea.h"
#include "desafios.h"
#include "cruces.h"
#include "obstaculo.h"

void detenerse(const char* mensaje) {
  motores(0, 0);
  Serial.println(mensaje);
  while (true) delay(1000);
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pinMode(PIN_IN1_IZQ, OUTPUT);
  pinMode(PIN_IN2_IZQ, OUTPUT);
  pinMode(PIN_IN1_DER, OUTPUT);
  pinMode(PIN_IN2_DER, OUTPUT);
  ledcAttach(PIN_PWM_IZQ, 5000, 8);
  ledcAttach(PIN_PWM_DER, 5000, 8);
  qtr.setTypeAnalog();
  qtr.setSensorPins(PINES_QTR, 8);
  qtr.setEmitterPin(PIN_LEDON_QTR);

  abrirCanal(CANAL_COLOR_IZQ);
  bool hayColorIzq = colorIzq.begin();
  abrirCanal(CANAL_COLOR_DER);
  bool hayColorDer = colorDer.begin();
  abrirCanal(CANAL_LASER);
  bool hayLaser = laser.begin();
  if (!hayColorIzq || !hayColorDer || !hayLaser) detenerse("Falta un sensor: revisa los cables SDA y SCL y los canales del multiplexor.");
  laser.startRangeContinuous(40);  // una medida nueva cada 40 ms
  if (mpu.begin() != 0) detenerse("No encuentro el MPU6050.");

  Serial.println("Midiendo el giroscopio: no muevas el robot...");
  mpu.calcOffsets();
  Serial.println("Calibrando el sensor de línea...");
  calibrarLinea();
  Serial.println("¡Listo! A recorrer la pista.");
}

void loop() {
  mpu.update();  // el giroscopio suma lo que gira: hay que leerlo seguido
  static unsigned long ultimoCalculo = 0;
  if (millis() - ultimoCalculo < PERIODO_MS) return;
  ultimoCalculo = millis();

  if (hayObstaculo()) {
    esquivar();
    return;
  }
  uint16_t posicion = leerLinea();
  revisarInvertida();
  if (hayCruce()) {
    resolverCruce();
    return;
  }
  if (cuantosVen() > 0) {
    seguirLinea(posicion);
  } else {
    cruzarCorte();
  }
}
