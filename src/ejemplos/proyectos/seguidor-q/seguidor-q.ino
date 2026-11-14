// Seguidor que aprende solo: aprendizaje por refuerzo (Q-learning) dentro del robot.
//
// Nadie le dice cómo seguir la línea. En cada paso el robot mira dónde ve la línea (su ESTADO),
// elige cuánto girar (su ACCIÓN) y recibe un premio: más si queda centrado, un castigo si la pierde.
// En la tabla Q anota cuánto premio espera de cada acción en cada estado, y la va corrigiendo con
// lo que le pasa. Al principio prueba al azar (explora); vuelta a vuelta usa más lo que aprendió.
//
// Al terminar cada vuelta guarda la tabla en su memoria (Preferences): la próxima vez que lo pruebes,
// sigue aprendiendo donde quedó. Mira la tarjeta «Memoria del robot». Para que parta de cero, aprieta
// «Borrar la memoria».
#include <QTRSensors.h>
#include <Preferences.h>
#include "pines.h"

QTRSensors qtr;
Preferences memoria;
uint16_t valores[8];

const int VELOCIDAD = 130;  // velocidad hacia adelante, de 0 a 255 · @ajustar aprendizaje 60..200
const float ALFA = 0.3;     // cuánto cambia lo aprendido con cada experiencia · @ajustar aprendizaje 0.05..0.9
const float GAMMA = 0.8;    // cuánto le importa el premio que viene después · @ajustar aprendizaje 0..0.99

// Estados: dónde ve la línea, en 9 franjas de izquierda a derecha, y uno más para "no la veo".
const int FRANJAS = 9;
const int SIN_LINEA = 9;
const int ESTADOS = 10;
// Acciones: cuánto girar. Negativo, hacia la izquierda; positivo, hacia la derecha.
const int ACCIONES = 5;
const int GIRO[ACCIONES] = {-100, -45, 0, 45, 100};
// Al empezar, la tabla espera un premio alto de todo: así el robot se anima a probar cada acción.
const float OPTIMISTA = 3.0;
const unsigned long PERIODO_MS = 20;  // decide cada 20 ms

float Q[ESTADOS][ACCIONES];  // la tabla Q: lo que aprendió
float epsilon = 0.3;          // la probabilidad de probar una acción al azar

int estadoAnterior = -1;
int accionAnterior = 0;
int ultimoLado = 1;  // hacia dónde vio la línea la última vez: 1 derecha, -1 izquierda
unsigned long ultimoPaso = 0;

// Para contar las vueltas: la partida tiene una barra atravesada.
unsigned long inicio = 0;
unsigned long inicioVuelta = 0;
unsigned long ultimaBarra = 0;
bool sobreBarra = false;
unsigned int vueltas = 0;
long pasosVuelta = 0;
long pasosCentrados = 0;

void motores(int izq, int der) {
  digitalWrite(PIN_IN1_IZQ, izq >= 0);
  digitalWrite(PIN_IN2_IZQ, izq < 0);
  digitalWrite(PIN_IN1_DER, der >= 0);
  digitalWrite(PIN_IN2_DER, der < 0);
  ledcWrite(PIN_PWM_IZQ, constrain(abs(izq), 0, 255));
  ledcWrite(PIN_PWM_DER, constrain(abs(der), 0, 255));
}

void girarCalibrando(int sentido, unsigned long ms) {
  unsigned long t0 = millis();
  motores(-128 * sentido, 128 * sentido);
  while (millis() - t0 < ms) qtr.calibrate();
}

// Lee el sensor de línea y dice en qué estado está; `error` queda en -3500 (izquierda) a 3500 (derecha).
int leerEstado(int& error) {
  uint16_t posicion = qtr.readLineBlack(valores);
  uint16_t mayor = 0;
  for (int i = 0; i < 8; i++) mayor = max(mayor, valores[i]);
  if (mayor < 300) return SIN_LINEA;
  error = (int)posicion - 3500;
  if (error > 0) ultimoLado = 1;
  if (error < 0) ultimoLado = -1;
  return min(FRANJAS - 1, (int)posicion * FRANJAS / 7001);
}

// El mayor premio que espera en un estado (con su mejor acción).
float mejorValor(int s) {
  float mejor = Q[s][0];
  for (int a = 1; a < ACCIONES; a++) mejor = max(mejor, Q[s][a]);
  return mejor;
}

// Elige una acción: a veces al azar (explorar) y casi siempre la mejor según la tabla (aprovechar).
int elegir(int s) {
  if (random(1000) < epsilon * 1000) return random(ACCIONES);
  int mejor = 0;
  int empates = 1;
  for (int a = 1; a < ACCIONES; a++) {
    if (Q[s][a] > Q[s][mejor] + 0.0001) {
      mejor = a;
      empates = 1;
    } else if (Q[s][a] > Q[s][mejor] - 0.0001 && random(++empates) == 0) {
      mejor = a;  // entre acciones igual de buenas, una al azar
    }
  }
  return mejor;
}

// La regla de Q-learning: corrige lo que esperaba de (s, a) con el premio que recibió y lo mejor
// que espera desde el estado al que llegó. Perder la línea termina la cuenta: no espera nada después.
void aprender(int s, int a, float premio, int siguiente) {
  float futuro = siguiente == SIN_LINEA ? 0 : GAMMA * mejorValor(siguiente);
  Q[s][a] += ALFA * (premio + futuro - Q[s][a]);
}

// Cuando pierde la línea, la busca girando hacia el lado donde la vio por última vez.
void buscarLinea() {
  motores(70 * ultimoLado, -70 * ultimoLado);
}

// Cuenta una vuelta cada vez que pasa por la barra de la partida (casi todos los sensores en negro).
void revisarVuelta() {
  int negros = 0;
  for (int i = 0; i < 8; i++) {
    if (valores[i] > 600) negros++;
  }
  bool barra = negros >= 6;
  if (barra && !sobreBarra && millis() - inicio > 1500 && millis() - ultimaBarra > 3000) {
    ultimaBarra = millis();
    terminarVuelta();
  }
  sobreBarra = barra;
}

void terminarVuelta() {
  vueltas++;
  unsigned long ms = millis() - inicioVuelta;
  int centrado = pasosVuelta > 0 ? (int)(100 * pasosCentrados / pasosVuelta) : 0;
  Serial.printf("Vuelta %u: %d %% del tiempo centrado, %lu,%lu s\n", vueltas, centrado, ms / 1000, (ms % 1000) / 100);
  // Guarda lo aprendido una vez por vuelta (no en cada paso: la flash se gasta).
  memoria.putBytes("tabla", Q, sizeof(Q));
  memoria.putUInt("vueltas", vueltas);
  epsilon = max(0.02f, epsilon * 0.5f);  // cada vuelta explora la mitad que la anterior
  inicioVuelta = millis();
  pasosVuelta = 0;
  pasosCentrados = 0;
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

  memoria.begin("seguidor-q");
  vueltas = memoria.getUInt("vueltas", 0);
  if (memoria.getBytesLength("tabla") == sizeof(Q)) {
    memoria.getBytes("tabla", Q, sizeof(Q));
    epsilon = 0.05;  // ya sabe algo: explora poco
    Serial.println("Seguí aprendiendo con la tabla guardada.");
  } else {
    for (int s = 0; s < ESTADOS; s++)
      for (int a = 0; a < ACCIONES; a++) Q[s][a] = OPTIMISTA;
    Serial.println("Empiezo sin saber nada: voy a aprender probando.");
  }

  girarCalibrando(1, 150);
  girarCalibrando(-1, 300);
  girarCalibrando(1, 150);
  motores(0, 0);
  inicio = millis();
  inicioVuelta = inicio;
}

void loop() {
  if (millis() - ultimoPaso < PERIODO_MS) return;
  ultimoPaso = millis();

  int error = 0;
  int s = leerEstado(error);
  revisarVuelta();
  bool perdida = s == SIN_LINEA;
  float premio = perdida ? -1.0 : 1.0 - abs(error) / 3500.0;
  pasosVuelta++;
  if (!perdida && abs(error) < 1000) pasosCentrados++;

  if (estadoAnterior >= 0) aprender(estadoAnterior, accionAnterior, premio, s);
  if (perdida) {
    buscarLinea();
    estadoAnterior = -1;
    return;
  }
  int a = elegir(s);
  motores(VELOCIDAD + GIRO[a], VELOCIDAD - GIRO[a]);
  estadoAnterior = s;
  accionAnterior = a;
}
