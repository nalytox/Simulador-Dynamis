import { ordenarArchivos, tipoDeArchivo, type Proyecto } from '../proyecto/proyecto';
import { buscarDefiniciones } from './prototipos';

export interface UnidadCompilacion {
  ruta: string;
  lenguaje: 'c++' | 'c';
  codigo: string;
}

/** Problema del proyecto que impide compilar (no es un error de C++). */
export class ErrorProyecto extends Error {}

/** Quita el BOM y convierte los fines de línea de Windows y Mac antiguo en '\n'. */
export function normalizarTexto(texto: string): string {
  return texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

const directivaLinea = (linea: number, ruta: string) => `#line ${linea} ${JSON.stringify(ruta)}`;

/**
 * Prepara las unidades de compilación como el Arduino IDE: une los .ino de la raíz
 * (el principal primero), agrega Arduino.h y los prototipos, y conserva la numeración
 * original con directivas #line. Cada .cpp y .c es su propia unidad.
 */
export function prepararUnidades(p: Proyecto): UnidadCompilacion[] {
  const orden = ordenarArchivos(p);
  const inos = orden.filter(r => !r.includes('/') && tipoDeArchivo(r) === 'ino');
  if (inos.length === 0) {
    throw new ErrorProyecto('Tu proyecto no tiene ningún archivo .ino. Crea uno con el mismo nombre de la carpeta.');
  }

  const archivosIno = inos.map(ruta => {
    const texto = normalizarTexto(p.archivos[ruta]);
    return { ruta, lineas: texto.split('\n'), definiciones: buscarDefiniciones(texto) };
  });
  const prototipos = archivosIno.flatMap(a => a.definiciones.map(d => d.prototipo));
  const conPrototipos = archivosIno.findIndex(a => a.definiciones.length > 0);

  const partes = ['#include <Arduino.h>'];
  archivosIno.forEach((archivo, i) => {
    partes.push(directivaLinea(1, archivo.ruta));
    if (i === conPrototipos) {
      const primera = archivo.definiciones[0].linea;
      partes.push(
        ...archivo.lineas.slice(0, primera),
        ...prototipos,
        directivaLinea(primera + 1, archivo.ruta),
        ...archivo.lineas.slice(primera),
      );
    } else {
      partes.push(...archivo.lineas);
    }
  });

  const otras: UnidadCompilacion[] = orden
    .filter(r => tipoDeArchivo(r) === 'cpp' || tipoDeArchivo(r) === 'c')
    .map(ruta => ({
      ruta,
      lenguaje: tipoDeArchivo(ruta) === 'c' ? 'c' : 'c++',
      codigo: normalizarTexto(p.archivos[ruta]),
    }));

  return [{ ruta: `${p.nombre}.ino.cpp`, lenguaje: 'c++', codigo: partes.join('\n') }, ...otras];
}
