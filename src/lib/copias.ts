// Copias de seguridad.
//
// La copia cifrada no usa ninguna librería de criptografía: es la propia base exportada
// por SQLCipher (`sqlcipher_export`) a un archivo cifrado con la contraseña del
// usuario, que SQLCipher deriva con PBKDF2-HMAC-SHA512. La versión de la copia es su
// `user_version`, así que una copia antigua se importa pasando por las migraciones.
// Contraseña incorrecta o archivo dañado fallan igual: la base no se puede abrir.
//
// Los documentos y fotos van ENLAZADOS, no dentro: la copia lleva los enlaces, que solo
// valen en el mismo móvil. En otro, hay que volver a enlazarlos.

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SQLite from 'expo-sqlite';

import { conexion, estaCifrada, versionDe } from './db';
import { migrar, TABLAS, VERSION_ESQUEMA } from './esquema';
import { hoyISO } from './fechas';

export class ErrorCopia extends Error {
  constructor(public motivo: 'sin-cifrado' | 'contrasena' | 'futura') {
    super(motivo);
  }
}

/** URI 'file:///…' → ruta del sistema, que es lo que entiende SQLite en ATTACH. */
const ruta = (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, ''));
/** Comillas simples dobladas: la contraseña va dentro de un literal SQL. */
const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

function archivoNuevo(nombre: string): File {
  const f = new File(Paths.cache, nombre);
  if (f.exists) f.delete();
  return f;
}

export async function exportarCopia(contrasena: string): Promise<void> {
  if (!estaCifrada()) throw new ErrorCopia('sin-cifrado');
  const archivo = archivoNuevo(`hipo-${hoyISO()}.hipo`);
  const db = conexion();
  db.execSync(`ATTACH DATABASE ${literal(ruta(archivo.uri))} AS copia KEY ${literal(contrasena)}`);
  try {
    db.execSync("SELECT sqlcipher_export('copia')");
    // sqlcipher_export no copia user_version, y es la versión del formato.
    db.execSync(`PRAGMA copia.user_version = ${versionDe(db)}`);
  } finally {
    db.execSync('DETACH DATABASE copia');
  }
  await Sharing.shareAsync(archivo.uri, { mimeType: 'application/octet-stream', dialogTitle: 'HIPO' });
}

/** Devuelve false si se cancela la selección del archivo. */
export async function importarCopia(contrasena: string): Promise<boolean> {
  if (!estaCifrada()) throw new ErrorCopia('sin-cifrado');
  const elegido = await File.pickFileAsync();
  if (elegido.canceled) return false;
  const temporal = archivoNuevo('importar.hipo');
  elegido.result.copySync(temporal);

  try {
    // 1. Abrirla aparte para comprobar la contraseña y migrarla a la versión actual.
    const copia = SQLite.openDatabaseSync(temporal.name, {}, ruta(Paths.cache.uri));
    try {
      copia.execSync(`PRAGMA key = ${literal(contrasena)}`);
      copia.getFirstSync('SELECT count(*) FROM sqlite_master');
    } catch {
      copia.closeSync();
      throw new ErrorCopia('contrasena');
    }
    const version = versionDe(copia);
    if (version > VERSION_ESQUEMA) {
      copia.closeSync();
      throw new ErrorCopia('futura');
    }
    migrar((sql) => copia.execSync(sql), version);
    copia.closeSync();

    // 2. Reemplazar los datos en una sola transacción: o entra entera o no cambia nada.
    const db = conexion();
    db.execSync(`ATTACH DATABASE ${literal(ruta(temporal.uri))} AS copia KEY ${literal(contrasena)}`);
    try {
      db.withTransactionSync(() => {
        for (const t of [...TABLAS].reverse()) db.execSync(`DELETE FROM main.${t}`);
        for (const t of TABLAS) db.execSync(`INSERT INTO main.${t} SELECT * FROM copia.${t}`);
      });
    } finally {
      db.execSync('DETACH DATABASE copia');
    }
  } finally {
    if (temporal.exists) temporal.delete();
  }
  return true;
}
