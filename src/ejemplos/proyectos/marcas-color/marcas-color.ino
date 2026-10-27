// Leer marcas de color en cruces: antes de cada cruce puede haber marcas verdes.
// Marca a la izquierda: girar a la izquierda. A la derecha: girar a la derecha. Sin marcas: derecho.
//
// El Dynamis V2 tiene dos sensores de color TCS34725 en la ventana de la base, uno a cada lado de la
// línea. Los dos usan la dirección 0x29, así que van en canales distintos del multiplexor TCA9548A:
// el izquierdo en el canal 0 y el derecho en el 1. Para leer uno, primero se abre su canal.
// Las marcas quedan justo antes del cruce y los sensores de color van detrás del sensor de línea:
// cuando el sensor de línea ve el cruce, el robot avanza hasta el centro mirando el piso con ellos.
#include <Wire.h>
#include <QTRSensors.h>
#include <Adafruit_TCS34725.h>
#include "pines.h"

QTRSensors qtr;
uint16_t valores[8];
// 2,4 ms de integración: una lectura rápida, para no frenar el seguidor de línea.
Adafruit_TCS34725 colorIzq(TCS34725_INTEGRATIONTIME_2_4MS, TCS34725_GAIN_4X);
Adafruit_TCS34725 colorDer(TCS34725_INTEGRATIONTIME_2_4MS, TCS34725_GAIN_4X);

enum Color { BLANCO, NEGRO, VERDE };

const int VELOCIDAD = 90;               // velocidad hacia adelante, de 0 a 255
const float KP = 0.03;                  // cuánto corrige por cada unidad de error
const unsigned long ESPERA_CORTE = 400; // cuánto sigue derecho sin ver línea, en ms
const unsigned long AVANCE_AL_CENTRO = 400;  // ms para llevar las ruedas al centro del cruce
const int LECTURAS_VERDES = 2;          // lecturas viendo verde para creer que es una marca

unsigned long ultimaVezQueVioLinea = 0;

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

// Abre un canal del multiplexor TCA9548A: desde ahí el bus I2C llega al sensor de ese canal.
void abrirCanal(uint8_t canal) {
  Wire.beginTransmission(DIRECCION_MUX);
  Wire.write(1 << canal);
  Wire.endTransmission();
}

// Lee un sensor de color (abriendo su canal) y dice si ve blanco, negro o verde.
Color leerColor(Adafruit_TCS34725& sensor, uint8_t canal) {
  uint16_t r, g, b, c;
  abrirCanal(canal);
  sensor.getRawData(&r, &g, &b, &c);
  if (c < 60) return NEGRO;                         // casi no vuelve luz
  if (g > r + 20 && g > b + 15) return VERDE;       // el verde gana claramente
  return BLANCO;
}

bool esNegro(uint16_t v) { return v >= 750; }

int cuantosNegros() {
  int n = 0;
  for (int i = 0; i < 8; i++) {
    if (esNegro(valores[i])) n++;
  }
  return n;
}

// Gira sobre su eje (sentido 1 = izquierda, -1 = derecha) hasta encontrar la otra línea.
void girarHastaLaLinea(int sentido) {
  motores(-100 * sentido, 100 * sentido);
  delay(250);  // primero se sale de la línea por la que venía
  do {
    qtr.readLineBlack(valores);
  } while (!esNegro(valores[3]) && !esNegro(valores[4]));
}

// Avanza hasta el centro del cruce mirando el piso con los dos sensores de color. Las marcas están
// antes de la línea atravesada: cuando los dos sensores llegan a ella, deja de mirar (las marcas
// que hay después del cruce son para quien viene del otro lado).
void avanzarMirandoMarcas(bool& marcaIzquierda, bool& marcaDerecha) {
  int verdesIzquierda = 0, verdesDerecha = 0;
  bool mirando = true;
  motores(VELOCIDAD, VELOCIDAD);
  unsigned long inicio = millis();
  while (millis() - inicio < AVANCE_AL_CENTRO) {
    if (!mirando) continue;
    Color izq = leerColor(colorIzq, CANAL_COLOR_IZQ);
    Color der = leerColor(colorDer, CANAL_COLOR_DER);
    if (izq == VERDE) verdesIzquierda++;
    if (der == VERDE) verdesDerecha++;
    if (izq == NEGRO && der == NEGRO) mirando = false;
  }
  marcaIzquierda = verdesIzquierda >= LECTURAS_VERDES;
  marcaDerecha = verdesDerecha >= LECTURAS_VERDES;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pinMode(PIN_IN1_IZQ, OUTPUT);
  pinMode(PIN_IN2_IZQ, OUTPUT);
  pinMode(PIN_IN1_DER, OUTPUT);
  pinMode(PIN_IN2_DER, OUTPUT);
  ledcAttach(PIN_PWM_IZQ, 5000, 8);  // PWM de 5 kHz y 8 bits: de 0 a 255
  ledcAttach(PIN_PWM_DER, 5000, 8);
  qtr.setTypeAnalog();
  qtr.setSensorPins(PINES_QTR, 8);
  qtr.setEmitterPin(PIN_LEDON_QTR);  // la librería enciende los emisores al leer

  abrirCanal(CANAL_COLOR_IZQ);
  bool hayIzq = colorIzq.begin();
  abrirCanal(CANAL_COLOR_DER);
  bool hayDer = colorDer.begin();
  if (!hayIzq || !hayDer) {
    Serial.println("No encuentro los sensores de color. Revisa los cables SDA y SCL y los canales 0 y 1 del multiplexor.");
    while (true) delay(1000);
  }

  Serial.println("Calibrando...");
  girarCalibrando(1, 150);
  girarCalibrando(-1, 300);
  girarCalibrando(1, 150);
  Serial.println("¡Listo! A buscar marcas.");
  ultimaVezQueVioLinea = millis();
}

void loop() {
  uint16_t posicion = qtr.readLineBlack(valores);  // 0 a 7000; 3500 es el centro

  // Un cruce: la línea atravesada hace que casi todos los sensores de línea vean negro.
  // (La partida y la meta también tienen una línea atravesada.)
  if (cuantosNegros() >= 6) {
    bool marcaIzquierda, marcaDerecha;
    avanzarMirandoMarcas(marcaIzquierda, marcaDerecha);  // y lleva las ruedas al centro del cruce
    if (marcaIzquierda && !marcaDerecha) {
      Serial.println("Marca a la izquierda: giro a la izquierda.");
      girarHastaLaLinea(1);
    } else if (marcaDerecha && !marcaIzquierda) {
      Serial.println("Marca a la derecha: giro a la derecha.");
      girarHastaLaLinea(-1);
    } else {
      qtr.readLineBlack(valores);
      if (cuantosNegros() == 0) {  // después de la línea atravesada no sigue nada: es la meta
        motores(0, 0);
        Serial.println("¡Llegué a la meta!");
        while (true) delay(1000);
      }
      Serial.println("Sin marcas: sigo derecho.");
    }
    ultimaVezQueVioLinea = millis();
    return;
  }

  bool veLinea = false;
  for (int i = 0; i < 8; i++) {
    if (esNegro(valores[i])) veLinea = true;
  }
  if (veLinea) {
    ultimaVezQueVioLinea = millis();
    int error = (int)posicion - 3500;
    int correccion = KP * error;
    motores(VELOCIDAD + correccion, VELOCIDAD - correccion);
  } else if (millis() - ultimaVezQueVioLinea < ESPERA_CORTE) {
    motores(VELOCIDAD, VELOCIDAD);  // un corte: derecho hasta que vuelva la línea
  } else {
    motores(0, 0);
    Serial.println("Perdí la línea.");
    while (true) delay(1000);
  }
}
