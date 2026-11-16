import { ordenarArchivos, type Proyecto } from './proyecto';

/**
 * Lo que se puede hacer con los archivos y deshacer: crear, borrar, renombrar, mover pestañas y
 * elegir el programa. Cada operación devuelve su inversa, así que deshacer y rehacer son lo mismo:
 * aplicar la inversa. Solo tocan lo que cambian: el texto de los demás archivos queda como esté.
 */
export type Operacion =
  | { tipo: 'crear'; ruta: string; texto: string; indice?: number }
  | { tipo: 'borrar'; ruta: string }
  | { tipo: 'renombrar'; de: string; a: string }
  | { tipo: 'mover'; orden: string[] }
  | { tipo: 'principal'; ruta: string | undefined };

export interface Resultado {
  proyecto: Proyecto;
  inversa: Operacion;
  /** El archivo que conviene mostrar después. */
  enfocar?: string;
}

export function aplicar(p: Proyecto, op: Operacion): Resultado {
  const orden = ordenarArchivos(p);
  switch (op.tipo) {
    case 'crear': {
      const nuevoOrden = orden.filter(r => r !== op.ruta);
      nuevoOrden.splice(op.indice ?? nuevoOrden.length, 0, op.ruta);
      return {
        proyecto: { ...p, archivos: { ...p.archivos, [op.ruta]: op.texto }, orden: nuevoOrden },
        inversa: { tipo: 'borrar', ruta: op.ruta },
        enfocar: op.ruta,
      };
    }
    case 'borrar': {
      const { [op.ruta]: texto, ...archivos } = p.archivos;
      return {
        proyecto: { ...p, archivos, orden: orden.filter(r => r !== op.ruta) },
        inversa: { tipo: 'crear', ruta: op.ruta, texto: texto ?? '', indice: orden.indexOf(op.ruta) },
      };
    }
    case 'renombrar': {
      const archivos = Object.fromEntries(Object.entries(p.archivos).map(([r, t]) => [r === op.de ? op.a : r, t]));
      return {
        proyecto: {
          ...p, archivos,
          orden: orden.map(r => (r === op.de ? op.a : r)),
          ...(p.principal === op.de ? { principal: op.a } : {}),
        },
        inversa: { tipo: 'renombrar', de: op.a, a: op.de },
        enfocar: op.a,
      };
    }
    case 'mover':
      return { proyecto: { ...p, orden: op.orden }, inversa: { tipo: 'mover', orden } };
    case 'principal': {
      const { principal: anterior, ...resto } = p;
      return {
        proyecto: op.ruta === undefined ? resto : { ...resto, principal: op.ruta },
        inversa: { tipo: 'principal', ruta: anterior },
      };
    }
  }
}

/** Qué le pasó al proyecto, para el aviso con «Deshacer». */
export function describir(op: Operacion): string {
  switch (op.tipo) {
    case 'crear': return `Creaste ${op.ruta}`;
    case 'borrar': return `Borraste ${op.ruta}`;
    case 'renombrar': return `Renombraste ${op.de} a ${op.a}`;
    case 'mover': return 'Moviste una pestaña';
    case 'principal': return op.ruta ? `Ahora corre ${op.ruta}` : 'Cambiaste el programa a ejecutar';
  }
}
