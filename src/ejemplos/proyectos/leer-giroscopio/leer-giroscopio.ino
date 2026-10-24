// Leer el giroscopio: el MPU6050 mide qué tan rápido gira el robot (en grados por segundo), y la
// librería MPU6050_light suma esa velocidad en el tiempo para saber cuánto ha girado: getAngleZ().
// Aquí el robot gira 90° a la izquierda y se detiene.
#include <Wire.h>
#include <MPU6050_light.h>
#include "pines.h"

MPU6050 mpu(Wire);
float inicio = 0;       // el ángulo al empezar a girar
unsigned long ultimoMensaje = 0;
bool termine = false;

// Mueve los motores: valores de -255 (atrás) a 255 (adelante).
void motores(int izq, int der) {
  digitalWrite(PIN_IN1_IZQ, izq >= 0);
  digitalWrite(PIN_IN2_IZQ, izq < 0);
  digitalWrite(PIN_IN1_DER, der >= 0);
  digitalWrite(PIN_IN2_DER, der < 0);
  analogWrite(PIN_PWM_IZQ, constrain(abs(izq), 0, 255));
  analogWrite(PIN_PWM_DER, constrain(abs(der), 0, 255));
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_IN1_IZQ, OUTPUT);
  pinMode(PIN_IN2_IZQ, OUTPUT);
  pinMode(PIN_IN1_DER, OUTPUT);
  pinMode(PIN_IN2_DER, OUTPUT);

  Wire.begin();
  if (mpu.begin() != 0) {  // 0 quiere decir que el sensor respondió
    Serial.println("No encuentro el MPU6050. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }

  // Con el robot quieto, mide lo que el sensor marca aunque no se mueva (tarda menos de un segundo).
  Serial.println("Midiendo el desvío del giroscopio. No me muevas...");
  mpu.calcOffsets();

  Serial.println("Giro a la izquierda hasta llegar a 90°");
  mpu.update();
  inicio = mpu.getAngleZ();
}

void loop() {
  mpu.update();  // lee el sensor y suma lo que giró: hay que llamarlo seguido
  float angulo = mpu.getAngleZ() - inicio;  // en grados; crece al girar a la izquierda

  if (!termine) {
    if (angulo >= 90) {
      motores(0, 0);
      termine = true;
      Serial.println("Giré 90°. ¡Listo!");
    } else if (angulo >= 70) {
      motores(-60, 60);    // ya va llegando: gira más despacio para no pasarse
    } else {
      motores(-110, 110);
    }
  }

  if (millis() - ultimoMensaje >= 250) {
    ultimoMensaje = millis();
    Serial.printf("Ángulo: %.1f°\n", angulo);
  }
}
