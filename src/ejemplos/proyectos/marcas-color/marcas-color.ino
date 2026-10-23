// Leer marcas de color en cruces: antes de cada cruce puede haber marcas verdes.
// Marca a la izquierda: girar a la izquierda. A la derecha: girar a la derecha. Sin marcas: derecho.
//
// El sensor de color de este robot queda muy a la derecha para ver las marcas, así que usamos el
// sensor de línea: el blanco da cerca de 0, el negro cerca de 1000 y el verde queda al medio.
#include <QTRSensors.h>
#include "pines.h"

QTRSensors qtr;
uint16_t valores[8];

const int VELOCIDAD = 90;               // velocidad hacia adelante, de 0 a 255
const float KP = 0.03;                  // cuánto corrige por cada unidad de error
const unsigned long ESPERA_CORTE = 400; // cuánto sigue derecho sin ver línea, en ms
const unsigned long AVANCE_AL_CENTRO = 380;  // ms para llevar las ruedas al centro del cruce

const int LECTURAS_VERDES = 5;          // lecturas seguidas viendo verde para creer que es una marca

int lecturasVerdesIzquierda = 0;
int lecturasVerdesDerecha = 0;
bool marcaIzquierda = false;
bool marcaDerecha = false;
unsigned long ultimaVezQueVioLinea = 0;
unsigned long ultimaMarca = 0;

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

bool esVerde(uint16_t v) { return v > 300 && v < 750; }
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
  Serial.println("¡Listo! A buscar marcas.");
  ultimaVezQueVioLinea = millis();
}

void loop() {
  uint16_t posicion = qtr.readLineBlack(valores);  // 0 a 7000; 3500 es el centro

  // Los sensores 0 a 2 miran a la izquierda de la línea y los 5 a 7, a la derecha. Al pasar
  // por el borde de la línea un sensor también puede dar un valor intermedio, pero solo por un
  // instante: una marca verde se ve en varias lecturas seguidas.
  bool verdeIzquierda = false;
  bool verdeDerecha = false;
  for (int i = 0; i < 3; i++) {
    if (esVerde(valores[i])) verdeIzquierda = true;
    if (esVerde(valores[7 - i])) verdeDerecha = true;
  }
  lecturasVerdesIzquierda = verdeIzquierda ? lecturasVerdesIzquierda + 1 : 0;
  lecturasVerdesDerecha = verdeDerecha ? lecturasVerdesDerecha + 1 : 0;
  if (lecturasVerdesIzquierda >= LECTURAS_VERDES) { marcaIzquierda = true; ultimaMarca = millis(); }
  if (lecturasVerdesDerecha >= LECTURAS_VERDES) { marcaDerecha = true; ultimaMarca = millis(); }
  // Una marca vieja (de hace más de un segundo) ya no cuenta.
  if (millis() - ultimaMarca > 1000) { marcaIzquierda = false; marcaDerecha = false; }

  // Un cruce: la línea atravesada hace que casi todos los sensores vean negro.
  // (La partida y la meta también tienen una línea atravesada.)
  if (cuantosNegros() >= 6) {
    motores(VELOCIDAD, VELOCIDAD);
    delay(AVANCE_AL_CENTRO);  // lleva las ruedas al centro del cruce
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
    marcaIzquierda = false;
    marcaDerecha = false;
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
