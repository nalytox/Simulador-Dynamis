#include "pines.h"

void setup() {
  Serial.begin(115200);
  pinMode(IN1_IZQ, OUTPUT); pinMode(IN2_IZQ, OUTPUT); pinMode(IN1_DER, OUTPUT); pinMode(IN2_DER, OUTPUT);
  digitalWrite(IN1_IZQ, HIGH); digitalWrite(IN2_IZQ, LOW); digitalWrite(IN1_DER, HIGH); digitalWrite(IN2_DER, LOW);
  analogWrite(PWM_IZQ, 120); analogWrite(PWM_DER, 120);
  Serial.println("hola");
}

void loop() {
  delay(100);
}
