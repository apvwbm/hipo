// Base de datos local cifrada: expo-sqlite compilado con SQLCipher (ver el plugin en
// app.json).
//
// La clave son 32 bytes aleatorios generados en el primer arranque y guardados en
// SecureStore (Android Keystore / iOS Keychain). Se pasa como clave en bruto
// (`x'…'`), lo que evita la derivación PBKDF2 en cada arranque: abrir es instantáneo.
//
// En Expo Go no hay SQLCipher: `PRAGMA key` se ignora y la base queda SIN cifrar.
// `estaCifrada()` lo dice, y las copias cifradas se niegan a funcionar ahí.
//
// Todo es síncrono a propósito: con los datos de una compra, cada consulta tarda
// microsegundos y así el store escribe y pinta en el mismo tick.

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { AJUSTES_DEFECTO, COMPRA_DEFECTO, migrar, TABLAS, TITULAR_DEFECTO } from './esquema';
import type { Ajustes, Archivo, Casa, Datos, Hipoteca, Marca, Titular } from '@/types';

const NOMBRE = 'hipo.db';
const CLAVE_SECURE_STORE = 'hipo.clave';

let db: SQLite.SQLiteDatabase;
let cifrada = false;

/** false en Expo Go, que no trae SQLCipher. */
export const estaCifrada = () => cifrada;

export const conexion = () => db;

async function claveCifrado(): Promise<string> {
  const guardada = await SecureStore.getItemAsync(CLAVE_SECURE_STORE);
  if (guardada) return guardada;
  const nueva = Array.from(Crypto.getRandomBytes(32), (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(CLAVE_SECURE_STORE, nueva);
  return nueva;
}

export const versionDe = (base: SQLite.SQLiteDatabase): number =>
  base.getFirstSync<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;

export async function abrir(): Promise<void> {
  const clave = await claveCifrado();
  db = SQLite.openDatabaseSync(NOMBRE);
  db.execSync(`PRAGMA key = "x'${clave}'"`);
  cifrada = db.getFirstSync('PRAGMA cipher_version') !== null;
  db.execSync('PRAGMA foreign_keys = ON');
  migrar((sql) => db.execSync(sql), versionDe(db));
}

// ── Filas ↔ objetos ──────────────────────────────────────────────────────────
// camelCase ↔ snake_case, booleanos ↔ 0/1 y objetos ↔ JSON.

type Fila = Record<string, SQLite.SQLiteBindValue>;
const aSnake = (s: string) => s.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
const aCamel = (s: string) => s.replace(/_([a-z])/g, (_, l: string) => l.toUpperCase());

function aFila(obj: object): Fila {
  const fila: Fila = {};
  for (const [k, v] of Object.entries(obj)) {
    fila[aSnake(k)] = typeof v === 'boolean' ? Number(v) : v !== null && typeof v === 'object' ? JSON.stringify(v) : v;
  }
  return fila;
}

function deFila<T>(fila: Record<string, unknown>, booleanos: string[] = [], json: string[] = []): T {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fila)) {
    const campo = aCamel(k);
    obj[campo] = booleanos.includes(campo) ? v === 1 : json.includes(campo) && typeof v === 'string' ? JSON.parse(v) : v;
  }
  return obj as T;
}

/**
 * INSERT … ON CONFLICT DO UPDATE y no INSERT OR REPLACE: REPLACE borra la fila antes
 * de insertarla, y ese borrado dispararía el `ON DELETE CASCADE` de `archivos.casa_id`
 * y el `SET NULL` de `hipotecas.casa_id` al editar una casa.
 */
function guardar(tabla: string, obj: object, conflicto = 'id') {
  const fila = aFila(obj);
  const cols = Object.keys(fila);
  const actualizar = cols.filter((c) => !conflicto.split(',').includes(c)).map((c) => `${c} = excluded.${c}`);
  db.runSync(
    `INSERT INTO ${tabla} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})
     ON CONFLICT (${conflicto}) DO ${actualizar.length ? `UPDATE SET ${actualizar.join(', ')}` : 'NOTHING'}`,
    Object.values(fila),
  );
}

// ── Lectura ──────────────────────────────────────────────────────────────────

function kv<T>(clave: string): T | null {
  const f = db.getFirstSync<{ valor: string }>('SELECT valor FROM kv WHERE clave = ?', clave);
  return f ? (JSON.parse(f.valor) as T) : null;
}

export function cargar(): Datos {
  const todas = (sql: string) => db.getAllSync<Record<string, unknown>>(sql);
  // Todo se mezcla con su valor por defecto: un campo nuevo de una versión futura
  // aparece sin migración. La mezcla es superficial, así que cada elemento por separado.
  return {
    casas: todas('SELECT * FROM casas ORDER BY creada DESC, rowid DESC').map((f) => {
      const c = deFila<Casa>(f, ['nueva'], ['caracteristicas', 'checks', 'visitas', 'negociacion', 'compra']);
      return { ...c, compra: c.compra && { ...COMPRA_DEFECTO, ...c.compra } };
    }),
    hipotecas: todas('SELECT * FROM hipotecas ORDER BY rowid').map((f) => deFila<Hipoteca>(f, ['descartada'], ['bonificaciones'])),
    archivos: todas('SELECT * FROM archivos ORDER BY creado, rowid').map((f) => deFila<Archivo>(f)),
    titulares: (kv<Titular[]>('titulares') ?? []).map((t) => ({ ...TITULAR_DEFECTO, ...t })),
    marcas: kv<Record<string, Marca>>('marcas') ?? {},
    ajustes: { ...AJUSTES_DEFECTO, ...kv<Partial<Ajustes>>('ajustes') },
  };
}

// ── Escritura ────────────────────────────────────────────────────────────────

export const transaccion = (fn: () => void) => db.withTransactionSync(fn);

const guardarKv = (clave: string, valor: unknown) => guardar('kv', { clave, valor: JSON.stringify(valor) }, 'clave');

export const guardarCasa = (c: Casa) => guardar('casas', c);
export const guardarHipoteca = (h: Hipoteca) => guardar('hipotecas', h);
export const guardarArchivo = (a: Archivo) => guardar('archivos', a);
export const guardarAjustes = (a: Ajustes) => guardarKv('ajustes', a);
export const guardarTitulares = (t: Titular[]) => guardarKv('titulares', t);
export const guardarMarcas = (m: Record<string, Marca>) => guardarKv('marcas', m);

export const borrarCasa = (id: string) => db.runSync('DELETE FROM casas WHERE id = ?', id);
export const borrarHipoteca = (id: string) => db.runSync('DELETE FROM hipotecas WHERE id = ?', id);
/** Solo la fila: el archivo del móvil no se toca nunca. */
export const borrarArchivo = (id: string) => db.runSync('DELETE FROM archivos WHERE id = ?', id);

export function borrarTodo() {
  transaccion(() => {
    for (const t of [...TABLAS].reverse()) db.execSync(`DELETE FROM ${t}`);
  });
}
