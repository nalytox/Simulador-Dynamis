/** Las guías de cada sensor de la Ayuda: qué hace, cómo se usa y un programa completo que compila. */
export interface GuiaSensor {
  id: 'qtr' | 'vl53l0x' | 'tcs34725' | 'mpu6050' | 'motores';
  titulo: string;
  libreria: string;
  explicacion: string[];
  programa: string;
  aviso?: string;
}

const AVISO_I2C = 'El VL53L0X y los dos TCS34725 usan la misma dirección I2C (0x29). En el Dynamis V2 cada uno va en su canal del multiplexor TCA9548A (0x70): canal 0 el TCS34725 izquierdo, 1 el derecho y 2 el VL53L0X. Abre el canal del sensor antes de usarlo; si abres dos de ellos a la vez, chocan y el simulador te avisa.';

/** Abrir un canal del multiplexor, para los programas de los sensores en 0x29. */
const ABRIR_CANAL = `// Abre un canal del multiplexor TCA9548A (0x70): desde ahí el bus I2C llega al sensor de ese canal.
void abrirCanal(uint8_t canal) {
  Wire.beginTransmission(0x70);
  Wire.write(1 << canal);
  Wire.endTransmission();
}`;

export const GUIAS: GuiaSensor[] = [
  {
    id: 'qtr',
    titulo: 'Sensor de línea QTRX-MD-08A',
    libreria: 'QTRSensors (Pololu)',
    explicacion: [
      'Tiene 8 sensores, a 8 mm uno de otro y a 7 mm del piso, que miden cuánta luz rebota en el suelo: el blanco rebota mucha y el negro, poca.',
      'En la placa V2 los sensores van en D36, D39, D34, D35, D32, D33, D25 y D26 (de izquierda a derecha), y sus emisores se encienden con LEDON en D27: setEmitterPin(27) deja que la librería los encienda al leer.',
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
  qtr.setEmitterPin(27);  // LEDON: la librería enciende los emisores al leer
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
    libreria: 'Adafruit_VL53L0X',
    explicacion: [
      'Mide la distancia hasta lo que tiene adelante con un rayo láser infrarrojo, en milímetros (hasta unos 2 m).',
      'Cada medida tarda unos 33 ms. Si RangeStatus es 4, no vio nada: está fuera de alcance.',
      'Para no detener el programa mientras mide, usa startRangeContinuous() y, cuando isRangeComplete() diga que hay una medida nueva, léela con readRangeResult().',
      'En el Dynamis V2 va en el canal 2 del multiplexor: ábrelo antes de begin() y déjalo abierto mientras lo usas. Con el canal cerrado, begin() devuelve false y las medidas fallan.',
    ],
    programa: `#include <Wire.h>
#include <Adafruit_VL53L0X.h>

Adafruit_VL53L0X distancia;

${ABRIR_CANAL}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  abrirCanal(2);  // el VL53L0X está en el canal 2
  if (!distancia.begin()) {
    Serial.println("No encuentro el VL53L0X. Revisa los cables SDA y SCL y el canal 2 del multiplexor.");
    while (true) delay(1000);
  }
}

void loop() {
  VL53L0X_RangingMeasurementData_t medida;
  distancia.rangingTest(&medida, false);  // una medida: tarda unos 33 ms
  if (medida.RangeStatus != 4) Serial.printf("Distancia: %u mm\\n", medida.RangeMilliMeter);
  else Serial.println("No veo nada: está fuera de alcance.");
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
      'El Dynamis V2 tiene dos, uno a cada lado de la línea, en la ventana de la base. Los dos usan la dirección 0x29, así que van en el multiplexor TCA9548A (0x70): el izquierdo en el canal 0 y el derecho en el 1. Antes de leer uno, abre su canal.',
    ],
    programa: `#include <Wire.h>
#include <Adafruit_TCS34725.h>

Adafruit_TCS34725 izquierdo(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);
Adafruit_TCS34725 derecho(TCS34725_INTEGRATIONTIME_50MS, TCS34725_GAIN_4X);

${ABRIR_CANAL}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  abrirCanal(0);  // el TCS34725 izquierdo
  bool hayIzquierdo = izquierdo.begin();
  abrirCanal(1);  // el derecho
  bool hayDerecho = derecho.begin();
  if (!hayIzquierdo || !hayDerecho) {
    Serial.println("No encuentro los TCS34725. Revisa los cables SDA y SCL y los canales 0 y 1 del multiplexor.");
    while (true) delay(1000);
  }
}

void loop() {
  uint16_t r, g, b, c;
  abrirCanal(0);
  izquierdo.getRawData(&r, &g, &b, &c);
  Serial.printf("Izquierdo: R %u · G %u · B %u · C %u\\n", r, g, b, c);
  abrirCanal(1);
  derecho.getRawData(&r, &g, &b, &c);
  Serial.printf("Derecho:   R %u · G %u · B %u · C %u\\n", r, g, b, c);
  delay(200);
}
`,
    aviso: AVISO_I2C,
  },
  {
    id: 'mpu6050',
    titulo: 'Giroscopio y acelerómetro MPU6050',
    libreria: 'MPU6050_light',
    explicacion: [
      'El acelerómetro mide hacia dónde tira la gravedad y el giroscopio, qué tan rápido gira el robot (en °/s). La librería junta las dos cosas y entrega ángulos en grados.',
      'getAngleZ() dice cuánto ha girado el robot (crece al girar a la izquierda) y getAngleY(), su inclinación.',
      'En el Dynamis V2 el MPU6050 va mirando hacia atrás (su eje x apunta a la cola del robot): con la nariz hacia arriba getAngleY() es positiva. Si lo montas con el eje x hacia adelante, el signo de getAngleY() se invierte; getAngleZ() es igual en los dos casos.',
      'Llama a calcOffsets() con el robot quieto antes de empezar, y a update() muy seguido: así suma bien el giro.',
    ],
    programa: `#include <Wire.h>
#include <MPU6050_light.h>

MPU6050 mpu(Wire);
unsigned long ultimoMensaje = 0;

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (mpu.begin() != 0) {  // 0 quiere decir que el sensor respondió
    Serial.println("No encuentro el MPU6050. Revisa los cables SDA y SCL.");
    while (true) delay(1000);
  }
  Serial.println("Midiendo el desvío. No muevas el robot...");
  mpu.calcOffsets();
}

void loop() {
  mpu.update();  // lee el sensor y suma lo que giró
  if (millis() - ultimoMensaje >= 200) {
    ultimoMensaje = millis();
    // Con el MPU6050 mirando hacia atrás, getAngleY() es positiva con la nariz hacia arriba.
    Serial.printf("Inclinación %.1f° · giro %.1f° · %.0f °/s\\n", mpu.getAngleY(), mpu.getAngleZ(), mpu.getGyroZ());
  }
}
`,
  },
  {
    id: 'motores',
    titulo: 'Motores con el driver TB6612',
    libreria: 'Sin librería: pinMode, digitalWrite, ledcAttach y ledcWrite',
    explicacion: [
      'Cada motor usa tres pines: IN1 e IN2 dicen hacia dónde gira (HIGH y LOW: adelante; LOW y HIGH: atrás) y PWM dice qué tan rápido (de 0 a 255).',
      'En la placa V2: motor izquierdo PWM en D4, IN1 en D16 e IN2 en D17; motor derecho PWM en D19, IN1 en D5 e IN2 en D18. STBY va a 3V3, así que el driver siempre está activo.',
      'En el ESP32 el PWM lo hace el periférico LEDC: ledcAttach(pin, frecuencia, bits) prepara el pin y ledcWrite(pin, valor) fija la velocidad.',
      'Para girar, una rueda va más rápido que la otra, o una hacia adelante y la otra hacia atrás.',
    ],
    programa: `const int PWM_IZQ = 4, IN1_IZQ = 16, IN2_IZQ = 17;
const int PWM_DER = 19, IN1_DER = 5, IN2_DER = 18;

void setup() {
  Serial.begin(115200);
  pinMode(IN1_IZQ, OUTPUT);
  pinMode(IN2_IZQ, OUTPUT);
  pinMode(IN1_DER, OUTPUT);
  pinMode(IN2_DER, OUTPUT);
  ledcAttach(PWM_IZQ, 5000, 8);  // PWM de 5 kHz y 8 bits: de 0 a 255
  ledcAttach(PWM_DER, 5000, 8);

  // Las dos ruedas hacia adelante.
  digitalWrite(IN1_IZQ, HIGH);
  digitalWrite(IN2_IZQ, LOW);
  digitalWrite(IN1_DER, HIGH);
  digitalWrite(IN2_DER, LOW);
  ledcWrite(PWM_IZQ, 150);
  ledcWrite(PWM_DER, 150);
  Serial.println("Adelante a 150 de 255");
  delay(1000);

  ledcWrite(PWM_IZQ, 0);
  ledcWrite(PWM_DER, 0);
  Serial.println("Detenido");
}

void loop() {
}
`,
  },
];
