// Los papeles, por fases. Arriba lo que toca ahora (o lo que aún falta de antes); lo
// que ya tienes de fases anteriores se pliega, y lo de fases futuras aún no sale. Los
// archivos se quedan donde estén (Descargas, Drive, galería); aquí solo se enlazan.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Ayuda, Boton, Fila, Icono, Nota, Pantalla, Seccion, Vacio } from '@/components/ui';
import { useGuia, useHoy } from '@/hooks';
import { elegir } from '@/lib/archivos';
import { nombreTipo } from '@/lib/catalogo';
import { fechaCorta } from '@/lib/fechas';
import { caducaEl, type GrupoPapeles, type ItemDoc } from '@/lib/motor';
import { avisar, enlazar, useApp } from '@/store/app';
import { BORDE, color, espacio, TACTIL, typo } from '@/theme';

/** Lo que viene en la fase siguiente, para que no pille por sorpresa. */
const PROXIMOS: Record<number, string> = {
  1: 'Cuando elijas casa aparecerán sus papeles: nota simple, catastro, certificado energético y arras.',
  2: 'Cuando elijas casa aparecerán sus papeles: nota simple, catastro, certificado energético y arras.',
  3: 'Con la hipoteca llegará la tasación.',
};

export default function PantallaPapeles() {
  const { grupos, fase } = useGuia();
  const archivos = useApp((s) => s.archivos);
  const otros = useMemo(() => archivos.filter((a) => a.tipo === 'otro' && !a.casaId), [archivos]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [verHechos, setVerHechos] = useState(false);

  // Ahora: lo de esta fase y lo que falte de antes. Hechos: lo de antes que ya está.
  const hecho = (i: ItemDoc) => i.estado === 'ok' && i.tipo.fase < fase;
  const ahora = grupos.map((g) => ({ ...g, items: g.items.filter((i) => !hecho(i)) })).filter((g) => g.items.length);
  const hechos = grupos.map((g) => ({ ...g, items: g.items.filter(hecho) })).filter((g) => g.items.length);
  const nHechos = hechos.reduce((n, g) => n + g.items.length, 0);

  const enlazarOtro = async () => {
    const nuevos = enlazar(await elegir(), { tipo: 'otro', personaId: null, casaId: null });
    if (nuevos[0]) router.push({ pathname: '/documento', params: { id: nuevos[0].id } });
  };

  if (!grupos.length) {
    return (
      <Pantalla titulo="Papeles">
        <Vacio texto="Di quién compra y aquí irán saliendo los papeles que os pedirá el banco, fase a fase." cta="Añadir titular" onPress={() => router.push('/titular')} />
      </Pantalla>
    );
  }

  const lista = (gs: GrupoPapeles[]) =>
    gs.map((g) => (
      <Seccion key={g.clave} titulo={g.titulo}>
        {g.items.map((i) => {
          const clave = `${g.clave}:${i.tipo.clave}`;
          return <Item key={clave} i={i} g={g} abierto={abierto === clave} onAbrir={() => setAbierto(abierto === clave ? null : clave)} />;
        })}
      </Seccion>
    ));

  return (
    <Pantalla titulo="Papeles">
      {ahora.length ? lista(ahora) : <Nota tono="bien" texto="Tienes todos los papeles de esta fase." />}
      {PROXIMOS[fase] && <Ayuda>{PROXIMOS[fase]}</Ayuda>}

      {nHechos > 0 && (
        <Seccion>
          <Boton
            texto={`Ya los tienes (${nHechos})`}
            variante="texto"
            icono={verHechos ? 'chevron-up' : 'chevron-down'}
            onPress={() => setVerHechos(!verHechos)}
            style={{ alignSelf: 'flex-start' }}
          />
          {verHechos && lista(hechos)}
        </Seccion>
      )}

      <Seccion titulo="Otros documentos" derecha={<Boton texto="Enlazar" variante="texto" icono="link" onPress={() => void enlazarOtro()} />}>
        {otros.map((a) => (
          <Fila
            key={a.id}
            titulo={a.nota || 'Documento'}
            subtitulo={fechaCorta(a.emision ?? a.creado)}
            icono="file"
            onPress={() => router.push({ pathname: '/documento', params: { id: a.id } })}
            chevron
          />
        ))}
      </Seccion>
      <Nota icono="lock" texto="Los archivos se quedan donde están; la app solo guarda el enlace, cifrado. Si mueves o borras uno, vuelve a enlazarlo." />
    </Pantalla>
  );
}

function Item({ i, g, abierto, onAbrir }: { i: ItemDoc; g: GrupoPapeles; abierto: boolean; onAbrir: () => void }) {
  const hoy = useHoy();
  const estado =
    i.estado === 'ok'
      ? { icono: 'check-circle', tinte: color.verde, texto: 'Lo tienes' }
      : i.estado === 'caducado'
        ? { icono: 'alert-circle', tinte: color.ocre, texto: 'Caducado: pide uno nuevo' }
        : { icono: 'circle', tinte: color.texto3, texto: i.validos ? `Tienes ${i.validos} de ${i.necesita}` : 'Falta' };

  const anadir = async () => {
    const nuevos = enlazar(await elegir({ varios: i.necesita > 1 }), { tipo: i.tipo.clave, personaId: g.personaId, casaId: g.casaId });
    if (!nuevos.length || !i.tipo.vigencia) return;
    // Lo que caduca necesita su fecha de emisión: si no, cuenta desde hoy.
    if (nuevos.length === 1) router.push({ pathname: '/documento', params: { id: nuevos[0].id } });
    else avisar('Enlazados. Pon a cada uno su fecha de emisión para saber cuándo caduca.');
  };

  return (
    <View style={s.item}>
      <Pressable
        onPress={i.archivos.length ? onAbrir : () => void anadir()}
        style={s.cabecera}
        accessibilityRole="button"
        accessibilityLabel={`${i.tipo.nombre}: ${estado.texto}`}
      >
        <Icono nombre={estado.icono} tinte={estado.tinte} />
        <View style={{ flex: 1 }}>
          <Text style={typo.cuerpo}>{i.tipo.nombre}</Text>
          <Text style={[typo.apoyo, { color: i.estado === 'caducado' ? color.ocre : color.texto2 }]}>{estado.texto}</Text>
        </View>
        <Icono nombre={i.archivos.length ? (abierto ? 'chevron-up' : 'chevron-down') : 'link'} tam={18} tinte={color.texto3} />
      </Pressable>
      {abierto && (
        <View style={s.detalle}>
          {i.tipo.ayuda && <Ayuda>{i.tipo.ayuda}</Ayuda>}
          {i.archivos.map((a, n) => {
            const fin = caducaEl(a, i.tipo.vigencia);
            return (
              <Fila
                key={a.id}
                titulo={`${nombreTipo(a.tipo)}${i.archivos.length > 1 ? ` ${n + 1}` : ''}`}
                subtitulo={`${a.emision ? `Del ${fechaCorta(a.emision, hoy)}` : `Enlazado el ${fechaCorta(a.creado, hoy)}`}${fin ? (fin < hoy ? ' · caducado' : ` · vale hasta el ${fechaCorta(fin, hoy)}`) : ''}`}
                icono="file-text"
                tinteIcono={fin && fin < hoy ? color.ocre : undefined}
                onPress={() => router.push({ pathname: '/documento', params: { id: a.id } })}
                chevron
              />
            );
          })}
          <Boton texto="Enlazar otro" variante="texto" icono="plus" onPress={() => void anadir()} style={{ alignSelf: 'flex-start' }} />
        </View>
      )}
      {!abierto && !i.archivos.length && i.tipo.ayuda && <Text style={[typo.apoyo, s.ayudaCerrada]}>{i.tipo.ayuda}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  item: { borderBottomWidth: BORDE, borderBottomColor: color.linea },
  cabecera: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, minHeight: TACTIL + 8, paddingVertical: espacio.xs },
  detalle: { paddingLeft: espacio.xxl, paddingBottom: espacio.sm },
  ayudaCerrada: { color: color.texto3, paddingLeft: espacio.xxl, paddingBottom: espacio.sm, marginTop: -espacio.xs },
});
