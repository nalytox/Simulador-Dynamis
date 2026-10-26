import { it, expect } from 'vitest';
import { NOMBRE_TIPO, PALETA, type Pieza } from '../../src/ui/paleta';
import { baldosaEn, colocarBaldosa } from '../../src/pista/edicion';
import { escribirPista, normalizarPista, pistaVacia } from '../../src/pista/serializacion';
import { accionEsperada } from '../../src/pista/catalogo';
import type { TipoBaldosa } from '../../src/pista/tipos';

const piezas = PALETA.flatMap(g => g.piezas);
const pieza = (nombre: string) => piezas.find(p => p.nombre === nombre)!;
const colocar = (p: Pieza) => {
  if (p.clase !== 'baldosa') throw new Error(`${p.nombre} no es una baldosa`);
  return baldosaEn(colocarBaldosa(pistaVacia(), 0, 0, p.tipo, 0, p.props), 0, 0)!;
};

it('cada pieza de baldosa se puede colocar y da una pista válida', () => {
  for (const p of piezas) {
    if (p.clase !== 'baldosa') continue;
    const pista = colocarBaldosa(pistaVacia(), 0, 0, p.tipo, 0, p.props);
    expect(normalizarPista(JSON.parse(escribirPista(pista))).ok, p.nombre).toBe(true);
    expect(baldosaEn(pista, 0, 0)!.tipo).toBe(p.tipo);
  }
});

it('los atajos de marcas dan la acción esperada', () => {
  expect(accionEsperada(colocar(pieza('Marca a la izquierda')))).toBe('izq');
  expect(accionEsperada(colocar(pieza('Marca a la derecha')))).toBe('der');
  expect(accionEsperada(colocar(pieza('Marcas a ambos lados')))).toBe('vuelta');
  expect(accionEsperada(colocar(pieza('Marcas en las 4 puntas')))).toBe('vuelta');
  expect(accionEsperada(colocar(pieza('Cruce sin marcas')))).toBe('recto');
  expect(colocar(pieza('Unión en T (rama a la derecha)')).props).toMatchObject({ rama: 'der' });
  expect(colocar(pieza('Unión en T (rama a la izquierda)')).props).toMatchObject({ rama: 'izq' });
});

it('los grupos y los nombres de la paleta', () => {
  expect(PALETA.map(g => [g.grupo, g.piezas.map(p => p.nombre)])).toEqual([
    ['Líneas', ['Vacía', 'Recta', 'Giro suave', 'Giro en L', 'Línea con cortes', 'Rampa']],
    ['Cruces y marcas de color', ['Cruce sin marcas', 'Marca a la izquierda', 'Marca a la derecha', 'Marcas a ambos lados',
      'Marcas en las 4 puntas', 'Unión en T (rama a la izquierda)', 'Unión en T (rama a la derecha)']],
    ['Desafíos', ['Indicador F2', 'Cuadrado F1', 'Punto de desafío (F)']],
    ['Partida y meta', ['Partida', 'Meta', 'Inicio del robot']],
    ['Objetos', ['Obstáculo de 10 cm', 'Bache recto', 'Bache diagonal', 'Hito']],
  ]);
  expect(pieza('Punto de desafío (F)')).toEqual({ clase: 'objeto', nombre: 'Punto de desafío (F)', tipo: 'desafio' });
  expect(pieza('Bache diagonal')).toEqual({ clase: 'objeto', nombre: 'Bache diagonal', tipo: 'bache-diagonal' });
  expect(pieza('Inicio del robot')).toEqual({ clase: 'inicio', nombre: 'Inicio del robot' });
});

it('NOMBRE_TIPO nombra todos los tipos de baldosa', () => {
  const tipos: TipoBaldosa[] = ['vacia', 'recta', 'giroSuave', 'giroL', 'cortes', 'cruce', 'unionT', 'rampa', 'indicadorF2', 'cuadradoF1', 'partida', 'meta'];
  expect(Object.keys(NOMBRE_TIPO).sort()).toEqual([...tipos].sort());
  expect(NOMBRE_TIPO.cortes).toBe('Línea con cortes');
  expect(NOMBRE_TIPO.unionT).toBe('Unión en T');
});
