/** Diálogos simples con <dialog>: pedir un nombre o confirmar. Se cierran con Esc. */

function crear(raiz: Document, contenido: string): HTMLDialogElement {
  const d = raiz.createElement('dialog');
  d.className = 'dialogo';
  d.innerHTML = contenido;
  raiz.body.append(d);
  d.addEventListener('close', () => d.remove());
  return d;
}

/** Pide un nombre; `validar` devuelve el problema o null. Resuelve null si se cancela. */
export function pedirNombre(raiz: Document, o: { titulo: string; inicial: string; boton: string; validar(n: string): string | null }): Promise<string | null> {
  return new Promise(resolver => {
    const d = crear(raiz, `<form method="dialog"><h3></h3><label>Nombre del archivo <input autocomplete="off" spellcheck="false"></label>
      <p class="dialogo-error" role="alert"></p><div class="fila-botones"><button class="btn-sec" value="cancelar" formnovalidate>Cancelar</button>
      <button class="btn-probar" value="aceptar"></button></div></form>`);
    d.querySelector('h3')!.textContent = o.titulo;
    d.querySelector<HTMLButtonElement>('button[value="aceptar"]')!.textContent = o.boton;
    const input = d.querySelector('input')!;
    const error = d.querySelector<HTMLElement>('.dialogo-error')!;
    input.value = o.inicial;
    let resultado: string | null = null;
    d.querySelector('form')!.addEventListener('submit', e => {
      if ((e.submitter as HTMLButtonElement | null)?.value === 'cancelar') return;
      const problema = o.validar(input.value);
      if (problema) {
        e.preventDefault();
        error.textContent = problema;
        input.focus();
        return;
      }
      resultado = input.value.trim();
    });
    d.addEventListener('close', () => resolver(resultado));
    d.showModal();
    input.select();
  });
}

export function confirmar(raiz: Document, o: { titulo: string; boton: string }): Promise<boolean> {
  return new Promise(resolver => {
    const d = crear(raiz, `<form method="dialog"><h3></h3><div class="fila-botones"><button class="btn-sec" value="no">Cancelar</button>
      <button class="btn-probar" value="si"></button></div></form>`);
    d.querySelector('h3')!.textContent = o.titulo;
    d.querySelector<HTMLButtonElement>('button[value="si"]')!.textContent = o.boton;
    d.addEventListener('close', () => resolver(d.returnValue === 'si'));
    d.showModal();
  });
}

/** Menú pequeño de opciones (por ejemplo, Renombrar y Borrar), junto a un botón. */
export function elegirOpcion(raiz: Document, titulo: string, opciones: string[]): Promise<string | null> {
  return new Promise(resolver => {
    const d = crear(raiz, '<form method="dialog"><h3></h3><div class="fila-botones opciones"></div></form>');
    d.querySelector('h3')!.textContent = titulo;
    const fila = d.querySelector('.opciones')!;
    for (const texto of [...opciones, 'Cancelar']) {
      const b = raiz.createElement('button');
      b.className = 'btn-sec';
      b.value = texto;
      b.textContent = texto;
      fila.append(b);
    }
    d.addEventListener('close', () => resolver(d.returnValue && d.returnValue !== 'Cancelar' ? d.returnValue : null));
    d.showModal();
  });
}
