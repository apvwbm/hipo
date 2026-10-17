// Un documento enlazado: verlo, compartirlo, ponerle fecha o tipo, volver a enlazarlo
// si se ha movido, o quitar el enlace (el archivo nunca se borra del móvil).

import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Ayuda, Boton, CampoTexto, Chip, Chips, Pantalla, Seccion, SelectorFecha, Vacio } from '@/components/ui';
import { useHoy } from '@/hooks';
import { compartir, elegir, ver } from '@/lib/archivos';
import { nombreTipo, TIPOS_DOC, tipoDoc } from '@/lib/catalogo';
import { fechaCorta } from '@/lib/fechas';
import { caducaEl } from '@/lib/motor';
import { avisar, avisoArchivo, desenlazar, guardarArchivo, useApp } from '@/store/app';
import { espacio } from '@/theme';
import type { Archivo } from '@/types';

export default function PantallaDocumento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const a = useApp((s) => s.archivos).find((x) => x.id === id);
  const titulares = useApp((s) => s.titulares);
  const casas = useApp((s) => s.casas);
  const hoy = useHoy();
  if (!a) {
    return (
      <Pantalla titulo="Documento" atras>
        <Vacio texto="Este enlace ya no existe." />
      </Pantalla>
    );
  }
  const tipo = tipoDoc(a.tipo);
  const guardar = (p: Partial<Archivo>) => guardarArchivo({ ...a, ...p });
  const fin = caducaEl(a, tipo?.vigencia);
  const dueno = a.personaId ? titulares.find((t) => t.id === a.personaId)?.nombre : casas.find((c) => c.id === a.casaId)?.nombre;
  // Se puede reclasificar dentro de su ámbito: los de una persona o los de una casa.
  const tipos = TIPOS_DOC.filter((t) => (a.personaId ? t.grupo === 'titular' : a.casaId ? t.grupo !== 'titular' : false));

  const reenlazar = async () => {
    const [nuevo] = await elegir({ imagenes: a.tipo === 'foto' });
    if (!nuevo) return;
    guardar({ uri: nuevo.uri, mime: nuevo.mime });
    avisar('Enlace actualizado');
  };

  return (
    <Pantalla
      titulo={a.tipo === 'otro' && a.nota ? a.nota : nombreTipo(a.tipo)}
      atras
      pie={
        <View style={s.pie}>
          <Boton texto="Compartir" variante="secundario" icono="share-2" style={{ flex: 1 }} onPress={async () => avisoArchivo(await compartir(a))} />
          <Boton texto="Ver" icono="eye" style={{ flex: 1 }} onPress={async () => avisoArchivo(await ver(a))} />
        </View>
      }
    >
      {dueno ? <Ayuda>De {dueno}</Ayuda> : null}
      {tipos.length > 0 && (
        <Seccion titulo="Qué es">
          <Chips>
            {tipos.map((t) => (
              <Chip key={t.clave} texto={t.nombre} activo={a.tipo === t.clave} onPress={() => guardar({ tipo: t.clave })} />
            ))}
            <Chip texto="Otro" activo={a.tipo === 'otro'} onPress={() => guardar({ tipo: 'otro' })} />
          </Chips>
        </Seccion>
      )}
      <Seccion>
        <SelectorFecha
          etiqueta="Fecha de emisión"
          valor={a.emision}
          onCambio={(emision) => guardar({ emision })}
          opcional
          ayuda={
            tipo?.vigencia
              ? fin
                ? fin < hoy
                  ? `Caducó el ${fechaCorta(fin, hoy)}: pide uno nuevo.`
                  : `Vale hasta el ${fechaCorta(fin, hoy)}.`
                : undefined
              : 'Este documento no caduca.'
          }
        />
        {tipo?.vigencia && !a.emision ? <Ayuda>Sin fecha, cuenta desde que lo enlazaste ({fechaCorta(a.creado, hoy)}).</Ayuda> : null}
        <CampoTexto etiqueta="Descripción" valor={a.nota} onGuardar={(nota) => guardar({ nota })} placeholder={a.tipo === 'otro' ? 'Qué es' : 'Opcional'} />
      </Seccion>
      <Seccion titulo="Enlace">
        <Ayuda>El archivo sigue en tu móvil. Si lo has movido o cambiado de nombre, vuelve a enlazarlo.</Ayuda>
        <Boton texto="Volver a enlazar" variante="secundario" icono="link" onPress={() => void reenlazar()} />
        <Boton
          texto="Quitar enlace"
          variante="peligro"
          icono="x"
          onPress={() => {
            router.back();
            desenlazar(a);
          }}
        />
      </Seccion>
    </Pantalla>
  );
}

const s = StyleSheet.create({
  pie: { flexDirection: 'row', gap: espacio.md },
});
