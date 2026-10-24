// Esquivar el obstáculo: sigue la línea y mira hacia adelante con el sensor de distancia
// VL53L0X. Si hay algo cerca, lo rodea por la derecha haciendo un arco y vuelve a la línea.
// Los tiempos de los giros dependen del robot: si tu robot gira más rápido o más lento, ajústalos.
#include <Wire.h>
#include <QTRSensors.h>
#include <Adafruit_VL53L0X.h>
#include "pines.h"

QTRSensors qtr;
Adafruit_VL53L0X distancia;
uint16_t valores[8];

const int VELOCIDAD = 100;              // velocidad hacia adelante, de 0 a 255
const float KP = 0.03;                  // cuánto corrige por cada unidad de error
// Más cerca que esto, esquiva. Ojo: el sensor también ve el piso o una rampa a unos 10 cm
// cuando el robot se inclina, así que el límite tiene que ser menor que eso.
const int DISTANCIA_PARA_ESQUIVAR = 80;   // mm
const unsigned long GIRO_90 = 365;        // ms girando sobre su eje para girar unos 90°
const unsigned long APARTARSE = 570;      // ms avanzando para apartarse unos 20 cm
const unsigned long ARCO_MINIMO = 900;    // ms de arco antes de buscar la línea otra vez
const unsigned long AL_CENTRO = 390;      // ms para llevar las ruedas sobre la línea

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

bool veLineaAlCentro() {
  qtr.readLineBlack(valores);
  return valores[3] > 600 || valores[4] > 600;
}

// Gira sobre su eje (1 = izquierda, -1 = derecha) hasta que la línea quede bajo el centro.
void girarHastaLaLinea(int sentido) {
  motores(-110 * sentido, 110 * sentido);
  delay(150);  // primero deja de ver la línea sobre la que está
  while (!veLineaAlCentro()) delay(1);
}

// Rodea el obstáculo por la derecha: se aparta, hace un arco amplio hacia la izquierda hasta
// encontrar otra vez la línea, y se pone sobre ella mirando hacia adelante.
void esquivar() {
  Serial.println("¡Un obstáculo! Lo rodeo por la derecha.");
  motores(128, -128);          // gira unos 90° a la derecha
  delay(GIRO_90);
  motores(150, 150);           // se aparta del obstáculo
  delay(APARTARSE);
  motores(90, 160);            // arco hacia la izquierda: la rueda derecha va más rápido
  unsigned long inicio = millis();
  while (millis() - inicio < ARCO_MINIMO || !veLineaAlCentro()) delay(1);
  motores(VELOCIDAD, VELOCIDAD);
  delay(AL_CENTRO);            // las ruedas quedan sobre la línea
  girarHastaLaLinea(-1);       // y gira a la derecha hasta mirar a lo largo de ella
  Serial.println("Volví a la línea.");
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
  Wire.begin();
  pinMode(PIN_IN1_IZQ, OUTPUT);
  pinMode(PIN_IN2_IZQ, OUTPUT);
  pinMode(PIN_IN1_DER, OUTPUT);
  pinMode(PIN_IN2_DER, OUTPUT);
  qtr.setTypeAnalog();
  qtr.setSensorPins(PINES_QTR, 8);

  if (!distancia.begin()) {
    Serial.println("No encuentro el VL53L0X. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }
  distancia.startRangeContinuous(40);  // una medida nueva cada 40 ms (cada medida tarda 33 ms)

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

  // Sin esperar al sensor: solo cuando terminó una medida nueva.
  if (distancia.isRangeComplete()) {
    int mm = distancia.readRangeResult();  // 65535 si no ve nada
    if (mm < DISTANCIA_PARA_ESQUIVAR) {
      esquivar();
      return;
    }
  }

  int error = (int)posicion - 3500;
  int correccion = KP * error;
  motores(VELOCIDAD + correccion, VELOCIDAD - correccion);
}
