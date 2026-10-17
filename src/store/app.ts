// El estado de la app: un único store con todos los datos en memoria.
//
// Contrato de cada acción: primero SQLite (síncrono), luego `set()`. Así lo que se ve
// es siempre lo que está guardado, y la pantalla cambia en el mismo tick. Los datos de
// una compra caben de sobra en memoria; nada se consulta pantalla a pantalla.
//
// Lo calculado (costes, cuotas, fase, avisos) NO vive aquí: se deriva en `hooks.ts`
// con las funciones puras de `lib/motor.ts`.

import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { limpiarCache, type Enlace, type Resultado } from '@/lib/archivos';
import * as db from '@/lib/db';
import { AJUSTES_DEFECTO, COMPRA_DEFECTO, TITULAR_DEFECTO } from '@/lib/esquema';
import { hoyISO } from '@/lib/fechas';
import type { Ajustes, Archivo, Casa, Datos, EstadoCasa, Hipoteca, Id, Marca, Titular } from '@/types';

export type Aviso = { texto: string; deshacer?: () => void; id: number };

type Estado = Datos & {
  cargado: boolean;
  bloqueado: boolean;
  aviso: Aviso | null;
  /** Se refresca al volver a la app: las fechas y plazos se recalculan si cambia el día. */
  hoy: string;
};

export const nuevoId = () => randomUUID();

export const useApp = create<Estado>(() => ({
  cargado: false,
  bloqueado: false,
  aviso: null,
  hoy: hoyISO(),
  casas: [],
  hipotecas: [],
  archivos: [],
  titulares: [],
  marcas: {},
  ajustes: AJUSTES_DEFECTO,
}));

const get = useApp.getState;
const set = useApp.setState;

const reemplazar = <T extends { id: Id }>(lista: T[], item: T) =>
  lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [item, ...lista];

// ── Arranque ─────────────────────────────────────────────────────────────────

export async function iniciar() {
  await db.abrir();
  limpiarCache();
  const datos = db.cargar();
  set({ ...datos, cargado: true, bloqueado: datos.ajustes.bloqueo, hoy: hoyISO() });
}

export const recargar = () => set({ ...db.cargar(), hoy: hoyISO() });
export const nuevoDia = () => set({ hoy: hoyISO() });

// ── Avisos ───────────────────────────────────────────────────────────────────

let siguienteAviso = 0;
export const avisar = (texto: string, deshacer?: () => void) => set({ aviso: { texto, deshacer, id: ++siguienteAviso } });
export const cerrarAviso = () => set({ aviso: null });

/** Lo que pasa al ver o compartir un archivo enlazado, dicho en claro. */
export function avisoArchivo(r: Resultado) {
  if (r === 'roto') avisar('No encuentro el archivo: puede que lo hayas movido o borrado. Vuelve a enlazarlo.');
  if (r === 'sin-app') avisar('No hay ninguna app en el móvil para abrir este archivo.');
}

// ── Casas ────────────────────────────────────────────────────────────────────

export function guardarCasa(c: Casa) {
  db.guardarCasa(c);
  set((s) => ({ casas: reemplazar(s.casas, c) }));
}

export function nuevaCasa(datos: Pick<Casa, 'nombre' | 'precio' | 'zona' | 'nueva' | 'enlace'>): Id {
  const c: Casa = {
    id: nuevoId(),
    estado: 'interesa',
    valorReferencia: 0,
    m2: 0,
    habitaciones: 0,
    banos: 0,
    planta: '',
    anio: 0,
    energia: '',
    comunidad: 0,
    ibi: 0,
    reforma: 0,
    contacto: '',
    telefono: '',
    nota: '',
    puntos: 0,
    creada: hoyISO(),
    caracteristicas: [],
    checks: {},
    visitas: [],
    negociacion: [],
    compra: null,
    ...datos,
  };
  guardarCasa(c);
  return c.id;
}

/** Desde "oferta" la casa lleva su compra (precio acordado, fechas…). */
export function cambiarEstado(c: Casa, estado: EstadoCasa) {
  const conCompra = estado === 'oferta' || estado === 'arras' || estado === 'comprada';
  guardarCasa({ ...c, estado, compra: c.compra ?? (conCompra ? { ...COMPRA_DEFECTO, precio: c.precio } : null) });
}

/** "Ya he firmado las arras": la casa pasa a arras, con hoy como fecha si no tenía. */
export function firmarArras(c: Casa) {
  const compra = c.compra ?? { ...COMPRA_DEFECTO, precio: c.precio };
  guardarCasa({ ...c, estado: 'arras', compra: { ...compra, fechaArras: compra.fechaArras ?? hoyISO() } });
}

/** Borra la casa y sus enlaces (la base lo hace en cascada); "deshacer" lo devuelve todo. */
export function borrarCasa(c: Casa) {
  const { archivos, hipotecas } = get();
  const suyos = archivos.filter((a) => a.casaId === c.id);
  const suyas = hipotecas.filter((h) => h.casaId === c.id);
  db.borrarCasa(c.id);
  set((s) => ({
    casas: s.casas.filter((x) => x.id !== c.id),
    archivos: s.archivos.filter((a) => a.casaId !== c.id),
    hipotecas: s.hipotecas.map((h) => (h.casaId === c.id ? { ...h, casaId: null } : h)),
  }));
  avisar('Casa eliminada', () => {
    db.transaccion(() => {
      db.guardarCasa(c);
      suyos.forEach(db.guardarArchivo);
      suyas.forEach(db.guardarHipoteca);
    });
    set((s) => ({
      casas: reemplazar(s.casas, c),
      archivos: [...s.archivos, ...suyos],
      hipotecas: s.hipotecas.map((h) => suyas.find((x) => x.id === h.id) ?? h),
    }));
  });
}

// ── Hipotecas ────────────────────────────────────────────────────────────────

export function guardarHipoteca(h: Hipoteca) {
  db.guardarHipoteca(h);
  set((s) => ({ hipotecas: reemplazar(s.hipotecas, h) }));
}

/** Si era la elegida de una compra, deja de serlo (y "deshacer" lo devuelve). */
export function borrarHipoteca(h: Hipoteca) {
  const casas = get().casas.filter((c) => c.compra?.hipotecaId === h.id);
  db.transaccion(() => {
    db.borrarHipoteca(h.id);
    casas.forEach((c) => db.guardarCasa({ ...c, compra: { ...c.compra!, hipotecaId: null } }));
  });
  set((s) => ({
    hipotecas: s.hipotecas.filter((x) => x.id !== h.id),
    casas: s.casas.map((c) => (c.compra?.hipotecaId === h.id ? { ...c, compra: { ...c.compra, hipotecaId: null } } : c)),
  }));
  avisar('Oferta eliminada', () => {
    guardarHipoteca(h);
    casas.forEach(guardarCasa);
  });
}

// ── Archivos ─────────────────────────────────────────────────────────────────

export function enlazar(enlaces: Enlace[], base: Pick<Archivo, 'tipo' | 'personaId' | 'casaId'>): Archivo[] {
  const creado = hoyISO();
  const nuevos: Archivo[] = enlaces.map((e) => ({ id: nuevoId(), ...base, uri: e.uri, mime: e.mime, emision: null, nota: '', creado }));
  db.transaccion(() => nuevos.forEach(db.guardarArchivo));
  set((s) => ({ archivos: [...s.archivos, ...nuevos] }));
  return nuevos;
}

export function guardarArchivo(a: Archivo) {
  db.guardarArchivo(a);
  set((s) => ({ archivos: s.archivos.map((x) => (x.id === a.id ? a : x)) }));
}

/** Solo quita el enlace: el archivo sigue en el móvil. */
export function desenlazar(a: Archivo) {
  db.borrarArchivo(a.id);
  set((s) => ({ archivos: s.archivos.filter((x) => x.id !== a.id) }));
  avisar('Enlace quitado. El archivo sigue en tu móvil.', () => {
    db.guardarArchivo(a);
    set((s) => ({ archivos: [...s.archivos, a] }));
  });
}

// ── Titulares ────────────────────────────────────────────────────────────────

export const nuevoTitular = (): Titular => ({ id: nuevoId(), ...TITULAR_DEFECTO });

export function guardarTitular(t: Titular) {
  const titulares = get().titulares.some((x) => x.id === t.id) ? get().titulares.map((x) => (x.id === t.id ? t : x)) : [...get().titulares, t];
  db.guardarTitulares(titulares);
  set({ titulares });
}

/** Con él se van los enlaces a sus papeles. */
export function borrarTitular(t: Titular) {
  const antes = get().titulares;
  const suyos = get().archivos.filter((a) => a.personaId === t.id);
  const titulares = antes.filter((x) => x.id !== t.id);
  db.transaccion(() => {
    db.guardarTitulares(titulares);
    suyos.forEach((a) => db.borrarArchivo(a.id));
  });
  set((s) => ({ titulares, archivos: s.archivos.filter((a) => a.personaId !== t.id) }));
  avisar(`${t.nombre || 'Titular'} eliminado`, () => {
    db.transaccion(() => {
      db.guardarTitulares(antes);
      suyos.forEach(db.guardarArchivo);
    });
    set((s) => ({ titulares: antes, archivos: [...s.archivos, ...suyos] }));
  });
}

// ── Guía y ajustes ───────────────────────────────────────────────────────────

export function marcar(clave: string, marca: Marca | null) {
  const marcas = { ...get().marcas };
  if (marca) marcas[clave] = marca;
  else delete marcas[clave];
  db.guardarMarcas(marcas);
  set({ marcas });
}

export function cambiarAjustes(parcial: Partial<Ajustes>) {
  const ajustes = { ...get().ajustes, ...parcial };
  db.guardarAjustes(ajustes);
  set({ ajustes });
}

export function borrarTodo() {
  db.borrarTodo();
  set({ ...db.cargar(), bloqueado: false });
}

export const desbloquear = () => set({ bloqueado: false });
export const bloquear = () => set({ bloqueado: get().ajustes.bloqueo });
