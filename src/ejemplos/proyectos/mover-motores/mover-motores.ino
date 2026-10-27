// Mover los motores: el robot avanza, gira, retrocede y frena, y cuenta por el Serial
// qué está haciendo. Cambia los números para ver qué pasa.
#include "pines.h"

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

void setup() {
  Serial.begin(115200);
  pinMode(PIN_IN1_IZQ, OUTPUT);
  pinMode(PIN_IN2_IZQ, OUTPUT);
  pinMode(PIN_IN1_DER, OUTPUT);
  pinMode(PIN_IN2_DER, OUTPUT);
  ledcAttach(PIN_PWM_IZQ, 5000, 8);  // PWM de 5 kHz y 8 bits: de 0 a 255
  ledcAttach(PIN_PWM_DER, 5000, 8);

  Serial.println("Adelante");
  motores(150, 150);       // los dos motores hacia adelante, igual de rápido
  delay(1500);

  Serial.println("Giro a la izquierda");
  motores(-120, 120);      // una rueda atrás y la otra adelante: gira sobre su eje
  delay(350);

  Serial.println("Atrás");
  motores(-150, -150);     // los dos hacia atrás
  delay(1000);

  Serial.println("Freno");
  motores(0, 0);
}

void loop() {
  // Ya terminó: no hace nada más.
}
