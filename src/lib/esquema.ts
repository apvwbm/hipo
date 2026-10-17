// Esquema de la base de datos y valores por defecto. Sin dependencias de Expo, para
// que `scripts/verifica.ts` pueda probar las migraciones con el `node:sqlite` de Node.
//
// MIGRACIONES: cada entrada es el SQL que lleva de la versión i a la i + 1, y la
// versión vive en `PRAGMA user_version`. Reglas para no perder datos nunca:
//   - NUNCA editar una migración publicada; añadir otra al final.
//   - Solo cambios aditivos (`ADD COLUMN` con DEFAULT, tablas nuevas). Si hace falta
//     reestructurar una tabla: crear la nueva, copiar, borrar la vieja, renombrar.
// Las copias de seguridad llevan su `user_version`, así que una copia antigua se
// importa pasando por estas mismas migraciones.
//
// Lo pequeño y sin relaciones (ajustes, titulares, marcas de la guía) vive como JSON en
// `kv`; lo que tiene identidad y enlaces, en tablas. Las listas cortas de una casa
// (visitas, negociación, checklist, compra) van como JSON en su fila.

import type { Ajustes, Compra, Titular } from '@/types';

export const MIGRACIONES: string[] = [
  // 1 — esquema inicial
  `
  CREATE TABLE kv (clave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);

  CREATE TABLE casas (
    id TEXT PRIMARY KEY NOT NULL,
    nombre TEXT NOT NULL,
    zona TEXT NOT NULL DEFAULT '',
    estado TEXT NOT NULL CHECK (estado IN ('interesa', 'finalista', 'oferta', 'arras', 'comprada', 'descartada')),
    precio INTEGER NOT NULL DEFAULT 0 CHECK (precio >= 0),
    valor_referencia INTEGER NOT NULL DEFAULT 0 CHECK (valor_referencia >= 0),
    nueva INTEGER NOT NULL DEFAULT 0,
    m2 INTEGER NOT NULL DEFAULT 0 CHECK (m2 >= 0),
    habitaciones INTEGER NOT NULL DEFAULT 0 CHECK (habitaciones >= 0),
    banos INTEGER NOT NULL DEFAULT 0 CHECK (banos >= 0),
    planta TEXT NOT NULL DEFAULT '',
    anio INTEGER NOT NULL DEFAULT 0 CHECK (anio >= 0),
    energia TEXT NOT NULL DEFAULT '',
    comunidad INTEGER NOT NULL DEFAULT 0 CHECK (comunidad >= 0),
    ibi INTEGER NOT NULL DEFAULT 0 CHECK (ibi >= 0),
    reforma INTEGER NOT NULL DEFAULT 0 CHECK (reforma >= 0),
    enlace TEXT NOT NULL DEFAULT '',
    contacto TEXT NOT NULL DEFAULT '',
    telefono TEXT NOT NULL DEFAULT '',
    nota TEXT NOT NULL DEFAULT '',
    puntos INTEGER NOT NULL DEFAULT 0 CHECK (puntos BETWEEN 0 AND 5),
    creada TEXT NOT NULL,
    caracteristicas TEXT NOT NULL DEFAULT '[]',
    checks TEXT NOT NULL DEFAULT '{}',
    visitas TEXT NOT NULL DEFAULT '[]',
    negociacion TEXT NOT NULL DEFAULT '[]',
    compra TEXT
  );

  CREATE TABLE hipotecas (
    id TEXT PRIMARY KEY NOT NULL,
    banco TEXT NOT NULL,
    casa_id TEXT REFERENCES casas(id) ON DELETE SET NULL,
    importe INTEGER NOT NULL CHECK (importe >= 0),
    anios INTEGER NOT NULL CHECK (anios > 0),
    tipo TEXT NOT NULL CHECK (tipo IN ('fija', 'variable', 'mixta')),
    tin INTEGER NOT NULL CHECK (tin >= 0),
    anios_fijos INTEGER NOT NULL DEFAULT 0 CHECK (anios_fijos >= 0),
    diferencial INTEGER NOT NULL DEFAULT 0 CHECK (diferencial >= 0),
    bonificaciones TEXT NOT NULL DEFAULT '[]',
    tae INTEGER NOT NULL DEFAULT 0 CHECK (tae >= 0),
    contacto TEXT NOT NULL DEFAULT '',
    telefono TEXT NOT NULL DEFAULT '',
    nota TEXT NOT NULL DEFAULT '',
    descartada INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE archivos (
    id TEXT PRIMARY KEY NOT NULL,
    tipo TEXT NOT NULL,
    persona_id TEXT,
    casa_id TEXT REFERENCES casas(id) ON DELETE CASCADE,
    uri TEXT NOT NULL,
    mime TEXT NOT NULL DEFAULT '',
    emision TEXT,
    nota TEXT NOT NULL DEFAULT '',
    creado TEXT NOT NULL
  );
  CREATE INDEX archivos_casa ON archivos (casa_id);
  `,
];

export const VERSION_ESQUEMA = MIGRACIONES.length;

/** Las tablas con datos, en orden de dependencias (para copiar y para borrar al revés). */
export const TABLAS = ['kv', 'casas', 'hipotecas', 'archivos'] as const;

/**
 * Aplica las migraciones pendientes, cada una en su transacción junto con el cambio
 * de versión: o entra entera o no entra. `exec` y `version` abstraen el driver
 * (expo-sqlite en la app, node:sqlite en la verificación).
 */
export function migrar(exec: (sql: string) => void, version: number): number {
  if (version > VERSION_ESQUEMA) throw new Error('version-futura');
  for (let v = version; v < VERSION_ESQUEMA; v++) {
    try {
      exec(`BEGIN; ${MIGRACIONES[v]}; PRAGMA user_version = ${v + 1}; COMMIT;`);
    } catch (e) {
      exec('ROLLBACK');
      throw e;
    }
  }
  return VERSION_ESQUEMA;
}

// ── Valores por defecto ──────────────────────────────────────────────────────
// Lo que viene de `kv` y de las columnas JSON se mezcla con esto al cargar: un campo
// nuevo de una versión futura aparece con su valor por defecto sin migración. La mezcla
// es SUPERFICIAL: por eso los arrays se normalizan elemento a elemento.

export const AJUSTES_DEFECTO: Ajustes = {
  ccaa: null,
  impuestoPropio: null,
  gastosPct: 1_000,
  tasacion: 40_000,
  // Euríbor 12 meses de partida (media de septiembre de 2026). Sin internet no se
  // actualiza solo: la app pide revisarlo, sin enseñar fechas que envejecen.
  euribor: 3_247,
  financiacion: 80_000,
  plazo: 30,
  tinSupuesto: 3_000,
  ahorros: 0,
  bloqueo: false,
  ultimaCopia: null,
};

export const TITULAR_DEFECTO: Omit<Titular, 'id'> = {
  nombre: '',
  neto: 0,
  pagas: 12,
  deudas: 0,
  nacimiento: null,
  contrato: 'indefinido',
};

export const COMPRA_DEFECTO: Compra = {
  precio: 0,
  senal: 0,
  arras: 0,
  tipoArras: 'penitenciales',
  condicion: false,
  fechaArras: null,
  fechaLimite: null,
  tasacion: 0,
  fechaTasacion: null,
  fein: null,
  hipotecaId: null,
  acta: null,
  firma: null,
  notaria: '',
  reales: {},
};
