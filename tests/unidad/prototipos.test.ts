import { describe, it, expect } from 'vitest';
import { buscarDefiniciones } from '../../src/compilador/prototipos';
const protos = (c: string) => buscarDefiniciones(c).map(d => d.prototipo);

describe('buscarDefiniciones', () => {
  it('encuentra funciones de nivel superior con su línea', () =>
    expect(buscarDefiniciones('int a = 3;\nvoid setup() {\n}\nfloat calcular(int x, float y) { return x * y; }\n')).toEqual([
      { prototipo: 'void setup();', linea: 1 }, { prototipo: 'float calcular(int x, float y);', linea: 3 }]));
  it('quita argumentos por defecto y une firmas en varias líneas', () =>
    expect(protos('void mover(int izq,\n           int der = 100) {\n}\n')).toEqual(['void mover(int izq, int der);']));
  it('ignora llaves en cadenas, caracteres y comentarios', () =>
    expect(protos('const char* s = "{ no }";\nchar k = \'{\';\n// void falsa() {\n/* int otra() { */\nvoid real() { if (1) { } }\n')).toEqual(['void real();']));
  it('ignora templates, métodos de clase y Clase::metodo; conserva static inline', () =>
    expect(protos('template <typename T> T doble(T x) { return 2 * x; }\nclass Pid { public: float paso(float e) { return e; } };\nfloat Pid2::paso(float e) { return e; }\nstatic inline int uno() { return 1; }\n')).toEqual(['static inline int uno();']));
  it('no confunde objetos, constructores con argumentos ni lambdas', () =>
    expect(protos('VL53L0X sensor;\nServo s(3);\nauto f = []() { return 1; };\n#define MAX(a, b) { a }\n')).toEqual([]));
  it('acepta tipos de retorno compuestos y punteros', () =>
    expect(protos('unsigned long tiempo() { return 0; }\nconst char* nombre(void) { return ""; }\n')).toEqual(['unsigned long tiempo();', 'const char* nombre(void);']));
});

describe('buscarDefiniciones con comentarios dentro de la firma', () => {
  it('no deja comentarios de línea dentro del prototipo', () =>
    expect(protos('void mover(int izq,   // izquierda\n           int der) /* fin */ {\n}\n')).toEqual(['void mover(int izq, int der);']));
});

describe('buscarDefiniciones y la compilación condicional', () => {
  it('no genera prototipos para funciones dentro de #ifdef o #if 0', () =>
    expect(buscarDefiniciones('//#define DEPURAR\n#ifdef DEPURAR\nvoid depurar(int v) { }\n#endif\n#if 0\nvoid viejo(TipoViejo t) { }\n#endif\n\nvoid setup() { }\n'))
      .toEqual([{ prototipo: 'void setup();', linea: 8 }]));
});

describe('buscarDefiniciones con llaves desbalanceadas', () => {
  it('no convierte if, while, for ni firmas sin tipo en prototipos', () =>
    expect(protos('}\nif (modo == 1) {\n}\nwhile (millis() < 10) {\n}\nfor (int i = 0; i < 3; i++) {\n}\nsetup() {\n}\n')).toEqual([]));
});
