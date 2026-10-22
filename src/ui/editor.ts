import { basicSetup } from 'codemirror';
import { cpp } from '@codemirror/lang-cpp';
import { EditorView, Decoration, type DecorationSet } from '@codemirror/view';
import { StateEffect, StateField } from '@codemirror/state';

export interface EditorCodigo {
  mostrar(texto: string): void;
  texto(): string;
  /** Marca una línea (1 en adelante) con error; null la quita. Editar también la quita. */
  marcarLinea(linea: number | null): void;
  irALinea(linea: number): void;
  enfocar(): void;
}

const fijarError = StateEffect.define<number | null>();
const marcaError = Decoration.line({ class: 'linea-error' });

const campoError = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marcas, tr) {
    let resultado = tr.docChanged ? Decoration.none : marcas;
    for (const e of tr.effects) {
      if (!e.is(fijarError)) continue;
      const linea = e.value;
      resultado = linea === null || linea < 1 || linea > tr.state.doc.lines
        ? Decoration.none
        : Decoration.set([marcaError.range(tr.state.doc.line(linea).from)]);
    }
    return resultado;
  },
  provide: f => EditorView.decorations.from(f),
});

/** Tema con la paleta de Dynamis (spec §12). */
const tema = EditorView.theme({
  '&': { height: '470px', fontSize: '14px', backgroundColor: '#FFFFFF', color: '#12164A' },
  // Sin ligaduras: ">=" se ve como dos caracteres, igual que como se escribe.
  '.cm-scroller': { fontFamily: "'JetBrains Mono', monospace", lineHeight: '1.7', fontVariantLigatures: 'none' },
  '.cm-gutters': { backgroundColor: '#FFFFFF', color: '#9AA6C9', border: 'none' },
  '.cm-activeLine': { backgroundColor: '#F4FAFF' },
  '.cm-activeLineGutter': { backgroundColor: '#DDF4FF', color: '#0B0F98' },
  '&.cm-focused .cm-cursor': { borderLeftColor: '#0B0F98' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#DDF4FF' },
  '.linea-error': { backgroundColor: '#FFE8EC', boxShadow: 'inset 4px 0 0 #C4314B' },
});

export function crearEditor(contenedor: HTMLElement, alCambiar: (texto: string) => void): EditorCodigo {
  let cargando = false;
  const vista = new EditorView({
    parent: contenedor,
    extensions: [
      basicSetup, cpp(), tema, campoError,
      EditorView.contentAttributes.of({ 'aria-label': 'Código del programa' }),
      EditorView.updateListener.of(u => { if (u.docChanged && !cargando) alCambiar(u.state.doc.toString()); }),
    ],
  });
  return {
    mostrar(texto) {
      cargando = true;
      vista.dispatch({ changes: { from: 0, to: vista.state.doc.length, insert: texto }, effects: fijarError.of(null) });
      cargando = false;
    },
    texto: () => vista.state.doc.toString(),
    marcarLinea: linea => vista.dispatch({ effects: fijarError.of(linea) }),
    irALinea(linea) {
      const n = Math.min(Math.max(1, linea), vista.state.doc.lines);
      const { from } = vista.state.doc.line(n);
      vista.dispatch({ selection: { anchor: from }, effects: EditorView.scrollIntoView(from, { y: 'center' }) });
      vista.focus();
    },
    enfocar: () => vista.focus(),
  };
}
