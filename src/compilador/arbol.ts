/** Sistema de archivos virtual de @yowasp/clang: un árbol de carpetas anidadas. */
export type Arbol = { [nombre: string]: Arbol | string | Uint8Array };

export function aArbol(planos: Record<string, string | Uint8Array>): Arbol {
  const raiz: Arbol = {};
  for (const [ruta, contenido] of Object.entries(planos)) {
    const partes = ruta.split('/');
    let carpeta = raiz;
    for (const parte of partes.slice(0, -1)) {
      const siguiente = carpeta[parte];
      if (typeof siguiente === 'string' || siguiente instanceof Uint8Array) {
        throw new Error(`"${parte}" es un archivo y una carpeta a la vez`);
      }
      carpeta = (carpeta[parte] = siguiente ?? {}) as Arbol;
    }
    carpeta[partes[partes.length - 1]] = contenido;
  }
  return raiz;
}

export function leerDeArbol(arbol: Arbol, ruta: string): string | Uint8Array | undefined {
  let actual: Arbol | string | Uint8Array | undefined = arbol;
  for (const parte of ruta.split('/')) {
    if (actual === undefined || typeof actual === 'string' || actual instanceof Uint8Array) return undefined;
    actual = actual[parte];
  }
  return typeof actual === 'string' || actual instanceof Uint8Array ? actual : undefined;
}
