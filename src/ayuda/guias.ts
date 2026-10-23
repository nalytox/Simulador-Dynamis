/** Las guías de cada sensor de la Ayuda (spec §12): qué hace, cómo se usa y un programa completo que compila. */
export interface GuiaSensor {
  id: 'qtr' | 'vl53l0x' | 'tcs34725' | 'mpu6050' | 'mpu6050-i2cdevlib' | 'motores';
  titulo: string;
  libreria: string;
  explicacion: string[];
  programa: string;
  aviso?: string;
}

const AVISO_I2C = 'El VL53L0X y el TCS34725 usan la misma dirección I2C (0x29). El simulador no lo nota, pero en el robot real hay que cambiar la dirección del VL53L0X con setAddress (apagando el otro con XSHUT) o usar un multiplexor I2C.';

export const GUIAS: GuiaSensor[] = [
  {
    id: 'qtr',
    titulo: 'Sensor de línea QTR-MX-8A',
    libreria: 'QTRSensors (Pololu)',
    explicacion: [
      'Tiene 8 sensores que miden cuánta luz rebota en el suelo: el blanco rebota mucha y el negro, poca.',
      'Primero hay que calibrarlo moviéndolo sobre la línea y el fondo. Después, readLineBlack dice dónde está la línea: 0 bajo el sensor de la izquierda, 7000 bajo el de la derecha y 3500 al centro.',
    ],
    programa: `#include <QTRSensors.h>

QTRSensors qtr;
const uint8_t PINES_QTR[8] = {36, 39, 34, 35, 32, 33, 25, 26};
uint16_t valores[8];

void setup() {
  Serial.begin(115200);
  qtr.setTypeAnalog();
  qtr.setSensorPins(PINES_QTR, 8);
  // Para calibrar bien, mueve el sensor sobre la línea y el fondo mientras corre este ciclo.
  for (int i = 0; i < 100; i++) qtr.calibrate();
}

void loop() {
  uint16_t posicion = qtr.readLineBlack(valores);  // 0 a 7000; 3500 es el centro
  Serial.printf("Línea en %u · sensor 1: %u\\n", posicion, valores[0]);
  delay(200);
}
`,
  },
  {
    id: 'vl53l0x',
    titulo: 'Sensor de distancia VL53L0X',
    libreria: 'VL53L0X (Pololu)',
    explicacion: [
      'Mide la distancia hasta lo que tiene adelante con un rayo láser infrarrojo, en milímetros (hasta unos 2 m).',
      'En modo continuo entrega una medida nueva cada pocos milisegundos. Si no ve nada, entrega 8190 o más.',
    ],
    programa: `#include <Wire.h>
#include <VL53L0X.h>

VL53L0X distancia;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  distancia.setTimeout(500);
  if (!distancia.init()) {
    Serial.println("No encuentro el VL53L0X. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }
  distancia.startContinuous();
}

void loop() {
  int mm = distancia.readRangeContinuousMillimeters();
  if (distancia.timeoutOccurred()) Serial.println("El sensor se demoró demasiado.");
  else Serial.printf("Distancia: %d mm\\n", mm);
  delay(100);
}
`,
    aviso: AVISO_I2C,
  },
  {
    id: 'tcs34725',
    titulo: 'Sensor de color TCS34725',
    libreria: 'Adafruit_TCS34725',
    explicacion: [
      'Mide cuánta luz roja (R), verde (G) y azul (B) refleja el suelo, y la luz total (C).',
      'Con más tiempo de integración y más ganancia, las lecturas son más grandes. Compara R, G y B para saber el color: si G es el mayor, es verde.',
    ],
    programa: `#include <Wire.h>
#include <Adafruit_TCS34725.h>

Adafruit_TCS34725 tcs(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);

void setup() {
  Serial.begin(115200);
  if (!tcs.begin()) {
    Serial.println("No encuentro el TCS34725. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }
}

void loop() {
  uint16_t r, g, b, c;
  tcs.getRawData(&r, &g, &b, &c);
  Serial.printf("R %u · G %u · B %u · C %u\\n", r, g, b, c);
  delay(200);
}
`,
    aviso: AVISO_I2C,
  },
  {
    id: 'mpu6050',
    titulo: 'Giroscopio y acelerómetro MPU6050',
    libreria: 'Adafruit_MPU6050',
    explicacion: [
      'El acelerómetro mide hacia dónde tira la gravedad (en m/s²): sirve para saber si el robot sube o baja una rampa.',
      'El giroscopio mide qué tan rápido gira el robot (en rad/s): sumándolo en el tiempo se sabe cuánto giró.',
    ],
    programa: `#include <Adafruit_MPU6050.h>

Adafruit_MPU6050 mpu;

void setup() {
  Serial.begin(115200);
  if (!mpu.begin()) {
    Serial.println("No encuentro el MPU6050. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_2_G);
  mpu.setGyroRange(MPU6050_RANGE_250_DEG);
}

void loop() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  float inclinacion = atan2(a.acceleration.x, a.acceleration.z) * 180 / PI;
  Serial.printf("Inclinación %.1f° · giro %.2f rad/s\\n", inclinacion, g.gyro.z);
  delay(200);
}
`,
  },
  {
    id: 'mpu6050-i2cdevlib',
    titulo: 'MPU6050 con i2cdevlib',
    libreria: 'MPU6050 (i2cdevlib / Electronic Cats)',
    explicacion: [
      'Otra librería para el mismo sensor: entrega números enteros sin convertir a unidades.',
      'Con los rangos por defecto, 16384 en el acelerómetro es 1 g, y 131 en el giroscopio es 1 °/s.',
    ],
    programa: `#include <Wire.h>
#include <MPU6050.h>

MPU6050 mpu;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  mpu.initialize();
  if (!mpu.testConnection()) {
    Serial.println("No encuentro el MPU6050. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }
}

void loop() {
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  Serial.printf("az %d (16384 = 1 g) · gz %d (131 = 1 °/s)\\n", az, gz);
  delay(200);
}
`,
  },
  {
    id: 'motores',
    titulo: 'Motores con el driver TB6612',
    libreria: 'Sin librería: pinMode, digitalWrite y analogWrite',
    explicacion: [
      'Cada motor usa tres pines: IN1 e IN2 dicen hacia dónde gira (HIGH y LOW: adelante; LOW y HIGH: atrás) y PWM dice qué tan rápido (de 0 a 255).',
      'Para girar, una rueda va más rápido que la otra, o una hacia adelante y la otra hacia atrás.',
    ],
    programa: `const int PWM_IZQ = 18, IN1_IZQ = 16, IN2_IZQ = 17;
const int PWM_DER = 19, IN1_DER = 4, IN2_DER = 5;

void setup() {
  Serial.begin(115200);
  pinMode(IN1_IZQ, OUTPUT);
  pinMode(IN2_IZQ, OUTPUT);
  pinMode(IN1_DER, OUTPUT);
  pinMode(IN2_DER, OUTPUT);

  // Las dos ruedas hacia adelante.
  digitalWrite(IN1_IZQ, HIGH);
  digitalWrite(IN2_IZQ, LOW);
  digitalWrite(IN1_DER, HIGH);
  digitalWrite(IN2_DER, LOW);
  analogWrite(PWM_IZQ, 150);
  analogWrite(PWM_DER, 150);
  Serial.println("Adelante a 150 de 255");
  delay(1000);

  analogWrite(PWM_IZQ, 0);
  analogWrite(PWM_DER, 0);
  Serial.println("Detenido");
}

void loop() {
}
`,
  },
];
