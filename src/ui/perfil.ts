import { PERFILES, perfilDeSesion, recordarPerfil, type Perfil } from '../proyecto/perfiles';

/** Pregunta quién va a programar, salvo que esta pestaña ya lo sepa. */
export function elegirPerfil(raiz: Document, sesion: Pick<Storage, 'getItem' | 'setItem'>): Promise<Perfil> {
  const ya = perfilDeSesion(sesion);
  if (ya) return Promise.resolve(ya);
  const ventana = raiz.getElementById('ventana-perfil') as HTMLDialogElement;
  return new Promise(resolver => {
    let elegido = false;
    // Sin perfil no hay dónde guardar: Esc no cierra la ventana. Chrome igual la cierra si la página
    // todavía no tuvo un clic, así que en ese caso vuelve a abrirse.
    ventana.addEventListener('cancel', e => e.preventDefault());
    ventana.addEventListener('close', () => { if (!elegido) ventana.showModal(); });
    raiz.getElementById('perfiles')!.replaceChildren(...PERFILES.map(p => {
      const boton = raiz.createElement('button');
      boton.type = 'button';
      boton.className = 'perfil';
      boton.dataset.inicial = p.nombre[0];
      boton.textContent = p.nombre;
      // La inicial del círculo es decoración (::before): el nombre del botón es solo el nombre.
      boton.setAttribute('aria-label', p.nombre);
      boton.addEventListener('click', () => {
        elegido = true;
        recordarPerfil(sesion, p);
        ventana.close();
        resolver(p);
      });
      const li = raiz.createElement('li');
      li.append(boton);
      return li;
    }));
    ventana.showModal();
  });
}
