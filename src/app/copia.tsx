// Exportar o importar la copia cifrada con contraseña. La contraseña no se guarda en
// ningún sitio: la escribe el usuario cada vez.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Boton, Campo, Nota, Pantalla } from '@/components/ui';
import { ErrorCopia, exportarCopia, importarCopia } from '@/lib/copias';
import { estaCifrada } from '@/lib/db';
import { hoyISO } from '@/lib/fechas';
import { avisar, cambiarAjustes, recargar } from '@/store/app';

const LONGITUD_MINIMA = 6;
const MOTIVOS = {
  contrasena: 'No se ha podido abrir: la contraseña no es correcta o el archivo está dañado.',
  futura: 'Esta copia es de una versión más nueva de la app. Actualiza HIPO antes de importarla.',
  'sin-cifrado': 'Las copias cifradas solo funcionan en la app instalada (APK), no en Expo Go.',
};

export default function Copia() {
  const { modo } = useLocalSearchParams<{ modo: 'exportar' | 'importar' }>();
  const exportar = modo === 'exportar';
  const [contrasena, setContrasena] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const cifrado = estaCifrada();

  const fallo = (e: unknown) => setError(e instanceof ErrorCopia ? MOTIVOS[e.motivo] : String(e));

  const hacerExportar = async () => {
    if (contrasena.length < LONGITUD_MINIMA) return setError('Usa al menos 6 caracteres.');
    if (contrasena !== repetida) return setError('Las contraseñas no coinciden.');
    setOcupado(true);
    try {
      await exportarCopia(contrasena);
      cambiarAjustes({ ultimaCopia: hoyISO() });
      avisar('Copia creada');
      router.back();
    } catch (e) {
      fallo(e);
    } finally {
      setOcupado(false);
    }
  };

  const hacerImportar = () => {
    if (!contrasena) return setError('Escribe la contraseña de la copia.');
    Alert.alert('Importar copia', '¿Reemplazar todos los datos por los de la copia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Importar',
        style: 'destructive',
        onPress: async () => {
          setOcupado(true);
          try {
            if (await importarCopia(contrasena)) {
              recargar();
              avisar('Copia importada');
              router.replace('/');
            }
          } catch (e) {
            fallo(e);
          } finally {
            setOcupado(false);
          }
        },
      },
    ]);
  };

  return (
    <Pantalla
      titulo={exportar ? 'Exportar copia' : 'Importar copia'}
      atras
      pie={
        <Boton
          texto={exportar ? 'Exportar copia' : 'Elegir archivo e importar'}
          icono={exportar ? 'share' : 'download'}
          onPress={exportar ? hacerExportar : hacerImportar}
          deshabilitado={ocupado || !cifrado}
        />
      }
    >
      {!cifrado && <Nota tono="aviso" texto={MOTIVOS['sin-cifrado']} />}
      <Nota
        tono={exportar ? 'neutro' : 'peligro'}
        icono="lock"
        texto={exportar ? 'Elige una contraseña. La app no la guarda: sin ella la copia no se puede abrir.' : 'La copia REEMPLAZA todos los datos actuales.'}
      />
      <Nota
        texto="Los documentos y fotos no van dentro: van sus enlaces, que solo valen en este móvil. En otro móvil tendrás que volver a enlazarlos desde Papeles."
      />
      <Campo
        etiqueta="Contraseña"
        value={contrasena}
        onChangeText={(v) => {
          setContrasena(v);
          setError(null);
        }}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        error={exportar ? null : error}
      />
      {exportar && (
        <Campo
          etiqueta="Repite la contraseña"
          value={repetida}
          onChangeText={(v) => {
            setRepetida(v);
            setError(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          error={error}
        />
      )}
    </Pantalla>
  );
}
