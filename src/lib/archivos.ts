// Archivos del móvil ENLAZADOS, no copiados: el único sitio con código de archivos.
//
// - Enlazar: `File.pickFileAsync` abre el selector del sistema (Descargas, Drive,
//   galería…) y toma permiso PERSISTENTE sobre cada URI (`takePersistableUriPermission`
//   en `FilePickerContract.kt`): el enlace sigue valiendo tras reiniciar el móvil.
// - Ver: ACTION_VIEW con permiso de lectura para el visor (FLAG_GRANT_READ_URI_PERMISSION).
//   `Linking.openURL` no sirve: no concede ese permiso y el visor no podría leerlo.
// - Compartir: expo-sharing solo comparte archivos propios (`file://`), así que se copia
//   a la caché y se comparte la copia. La copia conserva el nombre real del archivo.
//
// NUNCA `File.delete()` sobre una URI guardada: la app suele tener permiso de escritura
// y borraría el archivo real del usuario. Desenlazar es borrar la fila y nada más.
//
// ponytail: Android guarda como mucho 128 permisos persistentes por app (512 desde
// Android 11) y suelta los más viejos sin avisar; por eso hay un tope de fotos por casa.
// Si se queda corto, copiar las fotos a almacenamiento privado.

import { Directory, File, Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export type Enlace = { uri: string; mime: string };
export type Resultado = 'ok' | 'roto' | 'sin-app';

const FLAG_GRANT_READ_URI_PERMISSION = 1;

function mimeDe(f: File): string {
  try {
    return f.type || '';
  } catch {
    return '';
  }
}

/**
 * Abre el selector del sistema; [] si se cancela. Ojo: `pickFileAsync` convierte
 * cualquier error en "cancelado", así que un fallo no se distingue de volver atrás.
 */
export async function elegir({ varios = false, imagenes = false } = {}): Promise<Enlace[]> {
  const mimeTypes = imagenes ? 'image/*' : '*/*';
  const elegidos: File[] = [];
  if (varios) {
    const r = await File.pickFileAsync({ multipleFiles: true, mimeTypes });
    if (!r.canceled) elegidos.push(...r.result);
  } else {
    const r = await File.pickFileAsync({ mimeTypes });
    if (!r.canceled) elegidos.push(r.result);
  }
  return elegidos.map((f) => ({ uri: f.uri, mime: mimeDe(f) }));
}

/** Llamar solo al tocar, nunca al pintar una lista: es una consulta síncrona a otra app. */
export function existe(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export async function ver(e: Enlace): Promise<Resultado> {
  if (!existe(e.uri)) return 'roto';
  if (Platform.OS !== 'android') return compartir(e);
  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: e.uri,
      type: e.mime || '*/*',
      flags: FLAG_GRANT_READ_URI_PERMISSION,
    });
    return 'ok';
  } catch {
    return 'sin-app';
  }
}

const carpetaCompartir = () => new Directory(Paths.cache, 'compartir');

export async function compartir(e: Enlace): Promise<Resultado> {
  if (!existe(e.uri)) return 'roto';
  const carpeta = carpetaCompartir();
  if (carpeta.exists) carpeta.delete();
  carpeta.create();
  // Asíncrono: `copySync` bloquea el hilo de JS y un PDF puede pesar.
  await new File(e.uri).copy(carpeta);
  const copia = carpeta.list()[0];
  if (!copia) return 'roto';
  await Sharing.shareAsync(copia.uri, { mimeType: e.mime || undefined, dialogTitle: 'HIPO' });
  return 'ok';
}

/** Al arrancar: fuera las copias que quedaron de compartir. */
export function limpiarCache() {
  try {
    const carpeta = carpetaCompartir();
    if (carpeta.exists) carpeta.delete();
  } catch {
    // Si no se puede, ya se borrará la próxima vez.
  }
}
