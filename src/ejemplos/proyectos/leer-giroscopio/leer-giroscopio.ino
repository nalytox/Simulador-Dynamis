// Leer el giroscopio: el MPU6050 mide qué tan rápido gira el robot (en radianes por segundo).
// Sumando esa velocidad en el tiempo se sabe cuánto ha girado. Aquí el robot gira 90° a la
// izquierda y se detiene.
#include <Adafruit_MPU6050.h>
#include "pines.h"

Adafruit_MPU6050 mpu;
float desvio = 0;       // lo que el giroscopio mide aunque el robot esté quieto
float angulo = 0;       // cuánto ha girado, en grados
unsigned long anterior = 0;
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

  if (!mpu.begin()) {
    Serial.println("No encuentro el MPU6050. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);

  // Con el robot quieto, mide el desvío del giroscopio durante medio segundo.
  Serial.println("Midiendo el desvío del giroscopio. No me muevas...");
  sensors_event_t a, g, temp;
  for (int i = 0; i < 100; i++) {
    mpu.getEvent(&a, &g, &temp);
    desvio += g.gyro.z;
    delay(5);
  }
  desvio /= 100;

  Serial.println("Giro a la izquierda hasta llegar a 90°");
  anterior = micros();
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  unsigned long ahora = micros();
  float segundos = (ahora - anterior) / 1000000.0;
  anterior = ahora;
  angulo += (g.gyro.z - desvio) * segundos * 180 / PI;  // de rad/s a grados

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
