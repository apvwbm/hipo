// Ficha de una casa, editable en el sitio (cada campo guarda al escribir). Tres partes:
// sus números y datos, la visita (fechas, lista de comprobación, fotos) y, desde que
// haces una oferta, la compra (negociación, arras, tasación, FEIN, acta, firma, costes).

import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Ayuda,
  Boton,
  BotonIcono,
  CampoDinero,
  CampoEntero,
  CampoTexto,
  Chip,
  Chips,
  Cifra,
  Fila,
  Icono,
  Interruptor,
  Nota,
  Pantalla,
  Seccion,
  Segmentado,
  SelectorFecha,
  Vacio,
} from '@/components/ui';
import { useCasa, useDatos, useGuia, useHipotecas, useHoy, useNumeros } from '@/hooks';
import { compartir, elegir } from '@/lib/archivos';
import { CARACTERISTICAS, comunidad, ENERGIAS, ESTADOS, nombreTipo, RATIO_ENDEUDAMIENTO, REVISIONES } from '@/lib/catalogo';
import { euros, eurosRedondos, pct } from '@/lib/dinero';
import { fechaCorta, relativa } from '@/lib/fechas';
import { firmaMinima } from '@/lib/motor';
import { avisar, avisoArchivo, borrarCasa, cambiarEstado, desenlazar, enlazar, firmarArras, guardarCasa, useApp } from '@/store/app';
import { BORDE, color, espacio, RADIO, TACTIL, typo } from '@/theme';
import type { Archivo, Casa, Compra, TipoArras } from '@/types';

type Parte = 'resumen' | 'visita' | 'compra';
const MAX_FOTOS = 12;

export default function FichaCasa() {
  const { id, parte: inicial } = useLocalSearchParams<{ id: string; parte?: Parte }>();
  const casa = useCasa(id);
  const enCompra = useGuia().x.compra;
  const [parte, setParte] = useState<Parte>(inicial ?? 'resumen');
  if (!casa) {
    return (
      <Pantalla titulo="Casa" atras>
        <Vacio texto="Esta casa ya no existe." />
      </Pantalla>
    );
  }
  const conCompra = !!casa.compra && casa.estado !== 'interesa' && casa.estado !== 'finalista' && casa.estado !== 'descartada';
  const vista = parte === 'compra' && !conCompra ? 'resumen' : parte;
  // Mientras no hayas elegido ninguna, cualquier candidata se puede elegir desde aquí.
  const elegible = !enCompra && (casa.estado === 'interesa' || casa.estado === 'finalista');

  return (
    <Pantalla
      titulo={casa.nombre}
      atras
      derecha={
        <BotonIcono
          icono="trash-2"
          etiqueta="Eliminar casa"
          tinte={color.texto2}
          onPress={() =>
            Alert.alert('Eliminar casa', `¿Eliminar "${casa.nombre}"? Sus fotos y documentos siguen en tu móvil; solo se quitan los enlaces.`, [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Eliminar',
                style: 'destructive',
                onPress: () => {
                  router.back();
                  borrarCasa(casa);
                },
              },
            ])
          }
        />
      }
    >
      <Chips>
        {ESTADOS.map((e) => (
          <Chip key={e.valor} texto={e.texto} activo={casa.estado === e.valor} onPress={() => cambiarEstado(casa, e.valor)} />
        ))}
      </Chips>
      {elegible && (
        <Boton
          texto="Esta es la casa"
          icono="check"
          onPress={() =>
            Alert.alert('Elegir casa', `¿Vas a por "${casa.nombre}"? Aparecerán los pasos y papeles para reservarla.`, [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Esta es',
                onPress: () => {
                  cambiarEstado(casa, 'oferta');
                  setParte('compra');
                },
              },
            ])
          }
        />
      )}
      <Segmentado<Parte>
        opciones={[
          { valor: 'resumen', texto: 'Resumen' },
          { valor: 'visita', texto: 'Visita' },
          ...(conCompra ? [{ valor: 'compra' as Parte, texto: 'Compra' }] : []),
        ]}
        valor={vista}
        onCambio={setParte}
      />
      {vista === 'resumen' && <Resumen casa={casa} />}
      {vista === 'visita' && <ParteVisita casa={casa} />}
      {vista === 'compra' && <ParteCompra casa={casa} />}
    </Pantalla>
  );
}

// ── Resumen: números y datos ─────────────────────────────────────────────────

function Resumen({ casa }: { casa: Casa }) {
  const n = useNumeros().get(casa.id)!;
  const d = useDatos();
  const archivos = useApp((s) => s.archivos);
  const docs = useMemo(() => archivos.filter((a) => a.casaId === casa.id && a.tipo !== 'foto'), [archivos, casa.id]);
  const guardar = (p: Partial<Casa>) => guardarCasa({ ...casa, ...p });
  const elegida = d.hipotecas.find((h) => h.id === casa.compra?.hipotecaId);
  const com = comunidad(d.ajustes.ccaa);

  const enlazarDoc = async () => {
    const nuevos = enlazar(await elegir(), { tipo: 'otro', personaId: null, casaId: casa.id });
    if (nuevos[0]) router.push({ pathname: '/documento', params: { id: nuevos[0].id } });
  };
  const abrirAnuncio = () => void Linking.openURL(/^https?:\/\//.test(casa.enlace) ? casa.enlace : `https://${casa.enlace}`);
  const telefono = casa.telefono.replace(/[^\d+]/g, '');
  const whatsapp = telefono.startsWith('+') ? telefono.slice(1) : telefono.length === 9 ? `34${telefono}` : telefono;

  return (
    <>
      <Seccion titulo="Lo que cuesta">
        <Cifra rotulo="Coste total" valor={eurosRedondos(n.coste.total)} apoyo={casa.precio ? undefined : 'Pon el precio para calcularlo.'} />
        {n.coste.lineas.map((l) => (
          <Fila key={l.clave} titulo={l.nombre} subtitulo={l.real !== null ? 'Lo pagado de verdad' : undefined} derecha={euros(l.real ?? l.importe)} />
        ))}
        {!d.ajustes.ccaa && <Nota tono="aviso" texto="Sin comunidad autónoma elegida, el impuesto es una estimación." accion={{ texto: 'Elegirla', onPress: () => router.push('/ajustes') }} />}
        {com.ivaDudoso && casa.nueva && <Nota tono="aviso" texto={`El ${com.nombreIva} de obra nueva en tu comunidad no está confirmado: revísalo y pon tu tipo en Ajustes.`} />}
      </Seccion>

      <Seccion titulo="Cómo se paga">
        <Fila titulo="Te presta el banco" subtitulo={elegida ? elegida.banco : `El ${pct(d.ajustes.financiacion)} del precio${casa.compra?.tasacion ? ' o de la tasación' : ''}`} derecha={eurosRedondos(n.prestamo)} />
        <Fila titulo="De tus ahorros" subtitulo={`Tienes ${eurosRedondos(d.ajustes.ahorros)}`} derecha={eurosRedondos(n.necesario)} tintoDerecha={n.falta ? color.acento : undefined} />
        {n.falta > 0 && <Nota tono="peligro" texto={`Te faltan ${eurosRedondos(n.falta)} de ahorros.`} />}
        <Fila titulo="Cuota" subtitulo={elegida ? 'Con la hipoteca elegida' : 'Con tu mejor oferta o el TIN supuesto'} derecha={`${euros(n.cuota)}/mes`} />
        <Fila titulo="Gasto al mes" subtitulo="Cuota, comunidad, IBI y seguros" derecha={`${euros(n.mensual)}/mes`} />
        {n.esfuerzo !== null && (
          <Ayuda tono={n.esfuerzo * 100_000 > RATIO_ENDEUDAMIENTO ? color.acento : color.texto2}>
            La cuota y tus otros préstamos se llevan el {Math.round(n.esfuerzo * 100)} % de los ingresos
            {n.esfuerzo * 100_000 > RATIO_ENDEUDAMIENTO ? `: más del ${pct(RATIO_ENDEUDAMIENTO)} que suele aceptar el banco.` : '.'}
          </Ayuda>
        )}
      </Seccion>

      <Seccion titulo="Datos">
        <CampoTexto etiqueta="Nombre" valor={casa.nombre} onGuardar={(nombre) => nombre && guardar({ nombre })} />
        <CampoTexto etiqueta="Zona" valor={casa.zona} onGuardar={(zona) => guardar({ zona })} />
        <CampoDinero etiqueta="Precio" valor={casa.precio} onGuardar={(precio) => guardar({ precio })} />
        <Interruptor titulo="Obra nueva" ayuda="IVA y AJD en vez de ITP." valor={casa.nueva} onCambio={(nueva) => guardar({ nueva })} />
        {!casa.nueva && (
          <CampoDinero
            etiqueta="Valor de referencia del Catastro"
            ayuda="Lo consultas gratis en la Sede del Catastro. Si es mayor que el precio, el ITP se paga sobre él."
            valor={casa.valorReferencia}
            onGuardar={(valorReferencia) => guardar({ valorReferencia })}
          />
        )}
        <View style={s.tres}>
          <View style={s.tercio}>
            <CampoEntero etiqueta="m²" valor={casa.m2} onGuardar={(m2) => guardar({ m2 })} />
          </View>
          <View style={s.tercio}>
            <CampoEntero etiqueta="Habitaciones" valor={casa.habitaciones} onGuardar={(habitaciones) => guardar({ habitaciones })} />
          </View>
          <View style={s.tercio}>
            <CampoEntero etiqueta="Baños" valor={casa.banos} onGuardar={(banos) => guardar({ banos })} />
          </View>
        </View>
        <View style={s.tres}>
          <View style={s.tercio}>
            <CampoTexto etiqueta="Planta" valor={casa.planta} onGuardar={(planta) => guardar({ planta })} />
          </View>
          <View style={s.tercio}>
            <CampoEntero etiqueta="Año" valor={casa.anio} onGuardar={(anio) => guardar({ anio })} />
          </View>
          <View style={s.tercio} />
        </View>
        <Text style={[typo.micro, { color: color.texto2 }]}>Certificado energético</Text>
        <Chips>
          {ENERGIAS.map((e) => (
            <Chip key={e} texto={e} activo={casa.energia === e} onPress={() => guardar({ energia: casa.energia === e ? '' : e })} />
          ))}
        </Chips>
        <Chips>
          {CARACTERISTICAS.map((c) => {
            const tiene = casa.caracteristicas.includes(c);
            return (
              <Chip
                key={c}
                texto={c}
                activo={tiene}
                onPress={() => guardar({ caracteristicas: tiene ? casa.caracteristicas.filter((x) => x !== c) : [...casa.caracteristicas, c] })}
              />
            );
          })}
        </Chips>
        <CampoDinero etiqueta="Comunidad al mes" valor={casa.comunidad} onGuardar={(comunidad) => guardar({ comunidad })} />
        <CampoDinero etiqueta="IBI al año" valor={casa.ibi} onGuardar={(ibi) => guardar({ ibi })} />
        <CampoDinero etiqueta="Reforma que harías" ayuda="Se suma al coste total y sale de tus ahorros." valor={casa.reforma} onGuardar={(reforma) => guardar({ reforma })} />
        <CampoTexto etiqueta="Notas" valor={casa.nota} onGuardar={(nota) => guardar({ nota })} multiline />
      </Seccion>

      <Seccion titulo="Anuncio y contacto">
        <CampoTexto etiqueta="Enlace del anuncio" valor={casa.enlace} onGuardar={(enlace) => guardar({ enlace })} keyboardType="url" autoCapitalize="none" />
        {casa.enlace ? <Boton texto="Abrir anuncio" variante="secundario" icono="external-link" onPress={abrirAnuncio} /> : null}
        <CampoTexto etiqueta="Contacto (agencia o dueño)" valor={casa.contacto} onGuardar={(contacto) => guardar({ contacto })} />
        <CampoTexto etiqueta="Teléfono" valor={casa.telefono} onGuardar={(t) => guardar({ telefono: t })} keyboardType="phone-pad" />
        {telefono ? (
          <View style={s.dos}>
            <Boton texto="Llamar" variante="secundario" icono="phone" style={{ flex: 1 }} onPress={() => void Linking.openURL(`tel:${telefono}`)} />
            <Boton texto="WhatsApp" variante="secundario" icono="message-circle" style={{ flex: 1 }} onPress={() => void Linking.openURL(`https://wa.me/${whatsapp}`)} />
          </View>
        ) : null}
      </Seccion>

      <Seccion titulo="Documentos de esta casa" derecha={<Boton texto="Enlazar" variante="texto" icono="link" onPress={() => void enlazarDoc()} />}>
        {docs.length === 0 && <Ayuda>La nota simple, el anuncio guardado, planos… El archivo se queda donde está; aquí solo se enlaza.</Ayuda>}
        {docs.map((a) => (
          <Fila
            key={a.id}
            titulo={a.tipo === 'otro' && a.nota ? a.nota : nombreTipo(a.tipo)}
            subtitulo={fechaCorta(a.emision ?? a.creado)}
            icono="file-text"
            onPress={() => router.push({ pathname: '/documento', params: { id: a.id } })}
            chevron
          />
        ))}
      </Seccion>
    </>
  );
}

// ── Visita: fechas, lista de comprobación, puntuación y fotos ────────────────

function ParteVisita({ casa }: { casa: Casa }) {
  const hoy = useHoy();
  const archivos = useApp((s) => s.archivos);
  const fotos = useMemo(() => archivos.filter((a) => a.casaId === casa.id && a.tipo === 'foto'), [archivos, casa.id]);
  const [fecha, setFecha] = useState<string | null>(null);
  const [hora, setHora] = useState('');
  const [abierta, setAbierta] = useState<Archivo | null>(null);
  const guardar = (p: Partial<Casa>) => guardarCasa({ ...casa, ...p });
  const visitas = [...casa.visitas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const revisar = (clave: string, r: 'bien' | 'mal') => {
    const checks = { ...casa.checks };
    if (checks[clave] === r) delete checks[clave];
    else checks[clave] = r;
    guardar({ checks });
  };
  const cuenta = (r: 'bien' | 'mal') => Object.values(casa.checks).filter((x) => x === r).length;

  const anadirFotos = async () => {
    const libres = MAX_FOTOS - fotos.length;
    const elegidas = await elegir({ varios: true, imagenes: true });
    if (elegidas.length > libres) avisar(`Caben ${MAX_FOTOS} fotos por casa: se han añadido ${Math.max(0, libres)}.`);
    enlazar(elegidas.slice(0, Math.max(0, libres)), { tipo: 'foto', personaId: null, casaId: casa.id });
  };

  return (
    <>
      <Seccion titulo="Visitas">
        {visitas.map((v, i) => (
          <View key={`${v.fecha}${v.hora}${i}`} style={s.filaVisita}>
            <Icono nombre={v.fecha < hoy ? 'check' : 'calendar'} tinte={v.fecha < hoy ? color.verde : color.texto} />
            <Text style={[typo.cuerpo, { flex: 1 }]}>
              {fechaCorta(v.fecha, hoy)}
              {v.hora ? ` · ${v.hora}` : ''}
              <Text style={[typo.apoyo, { color: color.texto2 }]}> · {relativa(v.fecha, hoy)}</Text>
            </Text>
            <BotonIcono icono="x" etiqueta="Quitar visita" tinte={color.texto3} onPress={() => guardar({ visitas: casa.visitas.filter((x) => x !== v) })} />
          </View>
        ))}
        <SelectorFecha etiqueta="Nueva visita" valor={fecha} onCambio={setFecha} opcional />
        {fecha && (
          <View style={s.dos}>
            <View style={{ flex: 1 }}>
              <CampoTexto key={casa.visitas.length} etiqueta="Hora (opcional)" valor={hora} onGuardar={setHora} placeholder="18:30" keyboardType="numbers-and-punctuation" />
            </View>
            <Boton
              texto="Añadir"
              icono="plus"
              style={{ alignSelf: 'flex-end' }}
              onPress={() => {
                guardar({ visitas: [...casa.visitas, { fecha, hora }] });
                setFecha(null);
                setHora('');
              }}
            />
          </View>
        )}
      </Seccion>

      <Seccion titulo="Tu nota">
        <Segmentado
          opciones={[0, 1, 2, 3, 4, 5].map((p) => ({ valor: p, texto: p ? String(p) : '—' }))}
          valor={casa.puntos}
          onCambio={(puntos) => guardar({ puntos })}
        />
      </Seccion>

      <Seccion titulo="Qué mirar y preguntar">
        <Ayuda>
          {cuenta('bien')} bien · {cuenta('mal')} mal · {REVISIONES.length - cuenta('bien') - cuenta('mal')} sin mirar. Se guarda en la casa, no en cada visita.
        </Ayuda>
        {(['mirar', 'preguntar'] as const).map((grupo) => (
          <View key={grupo}>
            <Text style={[typo.micro, s.grupo]}>{grupo === 'mirar' ? 'Mira' : 'Pregunta'}</Text>
            {REVISIONES.filter((r) => r.grupo === grupo).map((r) => (
              <View key={r.clave} style={s.revision}>
                <Text style={[typo.texto, { flex: 1 }]}>{r.texto}</Text>
                <Pressable
                  onPress={() => revisar(r.clave, 'bien')}
                  style={[s.voto, casa.checks[r.clave] === 'bien' && { backgroundColor: color.verdeSuave, borderColor: color.verde }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: casa.checks[r.clave] === 'bien' }}
                  accessibilityLabel={`${r.texto}: bien`}
                >
                  <Icono nombre="thumbs-up" tam={18} tinte={casa.checks[r.clave] === 'bien' ? color.verde : color.texto3} />
                </Pressable>
                <Pressable
                  onPress={() => revisar(r.clave, 'mal')}
                  style={[s.voto, casa.checks[r.clave] === 'mal' && { backgroundColor: color.acentoSuave, borderColor: color.acento }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: casa.checks[r.clave] === 'mal' }}
                  accessibilityLabel={`${r.texto}: mal`}
                >
                  <Icono nombre="thumbs-down" tam={18} tinte={casa.checks[r.clave] === 'mal' ? color.acento : color.texto3} />
                </Pressable>
              </View>
            ))}
          </View>
        ))}
      </Seccion>

      <Seccion titulo={`Fotos (${fotos.length})`} derecha={fotos.length < MAX_FOTOS ? <Boton texto="Añadir" variante="texto" icono="image" onPress={() => void anadirFotos()} /> : undefined}>
        {fotos.length === 0 && <Ayuda>Haz las fotos con la cámara en la visita y añádelas aquí: siguen en tu galería, la app solo las enlaza.</Ayuda>}
        <View style={s.rejilla}>
          {fotos.map((f) => (
            <Miniatura key={f.id} foto={f} onPress={() => setAbierta(f)} />
          ))}
        </View>
      </Seccion>
      {abierta && <Visor foto={abierta} onCerrar={() => setAbierta(null)} />}
    </>
  );
}

function Miniatura({ foto, onPress }: { foto: Archivo; onPress: () => void }) {
  const [rota, setRota] = useState(false);
  return (
    <Pressable onPress={onPress} style={s.miniatura} accessibilityRole="imagebutton" accessibilityLabel="Ver foto">
      {rota ? <Icono nombre="image" tinte={color.texto3} /> : <Image source={{ uri: foto.uri }} style={s.imagen} onError={() => setRota(true)} />}
    </Pressable>
  );
}

function Visor({ foto, onCerrar }: { foto: Archivo; onCerrar: () => void }) {
  const [rota, setRota] = useState(false);
  return (
    <Modal transparent animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <View style={s.visor}>
        {rota ? (
          <Text style={[typo.texto, { color: color.fondo, textAlign: 'center' }]}>No encuentro esta foto: puede que la hayas borrado de la galería.</Text>
        ) : (
          <Image source={{ uri: foto.uri }} style={{ flex: 1 }} resizeMode="contain" onError={() => setRota(true)} />
        )}
        <View style={s.dos}>
          <Boton texto="Compartir" variante="secundario" icono="share-2" style={s.botonVisor} onPress={async () => avisoArchivo(await compartir(foto))} />
          <Boton
            texto="Quitar"
            variante="secundario"
            icono="x"
            style={s.botonVisor}
            onPress={() => {
              desenlazar(foto);
              onCerrar();
            }}
          />
          <Boton texto="Cerrar" style={{ flex: 1 }} onPress={onCerrar} />
        </View>
      </View>
    </Modal>
  );
}

// ── Compra: de la oferta a las llaves ────────────────────────────────────────

function ParteCompra({ casa }: { casa: Casa }) {
  const k = casa.compra!;
  const d = useDatos();
  const hoy = useHoy();
  const n = useNumeros().get(casa.id)!;
  const ofertas = useHipotecas().filter((o) => !o.h.descartada);
  const [importe, setImporte] = useState(0);
  const [de, setDe] = useState<'yo' | 'vendedor'>('yo');
  const com = comunidad(d.ajustes.ccaa);
  const guardarCompra = (p: Partial<Compra>) => guardarCasa({ ...casa, compra: { ...k, ...p } });
  const minima = k.fein ? firmaMinima(k.fein, com.diasFein) : null;

  return (
    <>
      <Seccion titulo="Negociación">
        {casa.negociacion.map((p, i) => (
          <Fila key={i} titulo={p.de === 'yo' ? 'Tu oferta' : 'Contraoferta'} subtitulo={fechaCorta(p.fecha, hoy)} derecha={euros(p.importe)} />
        ))}
        <View style={s.dos}>
          <View style={{ flex: 1 }}>
            {/* La key lo vacía tras apuntar: el campo guarda lo escrito mientras tiene el foco. */}
            <CampoDinero key={casa.negociacion.length} etiqueta="Importe" valor={importe} onGuardar={setImporte} />
          </View>
          <Boton
            texto="Apuntar"
            icono="plus"
            deshabilitado={!importe}
            style={{ alignSelf: 'flex-end' }}
            onPress={() => {
              guardarCasa({ ...casa, negociacion: [...casa.negociacion, { fecha: hoy, importe, de, nota: '' }], compra: { ...k, precio: importe } });
              setImporte(0);
            }}
          />
        </View>
        <Segmentado
          opciones={[
            { valor: 'yo', texto: 'La ofrezco yo' },
            { valor: 'vendedor', texto: 'Me la piden' },
          ]}
          valor={de}
          onCambio={setDe}
        />
        <CampoDinero etiqueta="Precio acordado" ayuda="La última cifra apuntada pasa a ser el precio; cámbialo si no es así." valor={k.precio} onGuardar={(precio) => guardarCompra({ precio })} />
      </Seccion>

      <Seccion titulo="Reserva y arras">
        <CampoDinero
          etiqueta="Reserva o señal (si la hay)"
          ayuda="Si la agencia pide una reserva antes de las arras, lee qué firmas: si se descuenta del precio y si se devuelve."
          valor={k.senal}
          onGuardar={(senal) => guardarCompra({ senal })}
        />
        <CampoDinero etiqueta="Arras" ayuda={`Lo habitual es el 10 %: ${eurosRedondos(Math.round(k.precio / 10))}.`} valor={k.arras} onGuardar={(arras) => guardarCompra({ arras })} />
        <Segmentado<TipoArras>
          etiqueta="Tipo de arras"
          opciones={[
            { valor: 'penitenciales', texto: 'Penitenciales' },
            { valor: 'confirmatorias', texto: 'Confirmatorias' },
            { valor: 'penales', texto: 'Penales' },
          ]}
          valor={k.tipoArras}
          onCambio={(tipoArras) => guardarCompra({ tipoArras })}
        />
        <Ayuda>
          {k.tipoArras === 'penitenciales'
            ? 'Si te echas atrás pierdes las arras; si se echa atrás el vendedor, te devuelve el doble. Tiene que decirlo expresamente: si no, se entienden confirmatorias.'
            : k.tipoArras === 'confirmatorias'
              ? 'Son un pago a cuenta: nadie puede echarse atrás sin más, y el otro puede exigir la venta o una indemnización.'
              : 'Son una penalización por incumplir, y además se puede exigir que la venta siga adelante.'}
        </Ayuda>
        <Interruptor
          titulo="Condición de financiación"
          ayuda="Una cláusula que te devuelve las arras si el banco no te da la hipoteca. Muy recomendable."
          valor={k.condicion}
          onCambio={(condicion) => guardarCompra({ condicion })}
        />
        <SelectorFecha etiqueta="Firma de las arras" valor={k.fechaArras} onCambio={(fechaArras) => guardarCompra({ fechaArras })} opcional />
        <SelectorFecha etiqueta="Fecha límite para escriturar" valor={k.fechaLimite} onCambio={(fechaLimite) => guardarCompra({ fechaLimite })} opcional />
        {casa.estado === 'oferta' && (
          <Boton
            texto="Ya he firmado las arras"
            icono="arrow-right"
            onPress={() =>
              Alert.alert('Arras firmadas', 'Pasarás a conseguir la hipoteca.', [
                { text: 'Todavía no', style: 'cancel' },
                { text: 'Sí', onPress: () => firmarArras(casa) },
              ])
            }
          />
        )}
      </Seccion>

      <Seccion titulo="Hipoteca">
        <SelectorFecha etiqueta="Tasación" valor={k.fechaTasacion} onCambio={(fechaTasacion) => guardarCompra({ fechaTasacion })} opcional ayuda="La pagas tú y vale 6 meses." />
        <CampoDinero
          etiqueta="Valor de tasación"
          ayuda="El banco presta sobre el menor entre precio y tasación."
          valor={k.tasacion}
          onGuardar={(tasacion) => guardarCompra({ tasacion })}
        />
        <SelectorFecha
          etiqueta="Te dan la FEIN"
          valor={k.fein}
          onCambio={(fein) => guardarCompra({ fein })}
          opcional
          ayuda={minima ? `Puedes firmar desde el ${fechaCorta(minima, hoy)} (${com.diasFein} días naturales).` : `Desde la FEIN tienen que pasar ${com.diasFein} días naturales hasta firmar.`}
        />
        <Text style={[typo.micro, { color: color.texto2 }]}>Banco elegido</Text>
        {ofertas.length === 0 ? (
          <Boton texto="Apuntar ofertas" variante="secundario" icono="plus" onPress={() => router.push('/oferta')} />
        ) : (
          <Chips>
            {ofertas.map(({ h, r }) => (
              <Chip
                key={h.id}
                texto={`${h.banco} · ${euros(r.cuota)}`}
                activo={k.hipotecaId === h.id}
                onPress={() => guardarCompra({ hipotecaId: k.hipotecaId === h.id ? null : h.id })}
              />
            ))}
          </Chips>
        )}
      </Seccion>

      <Seccion titulo="Firma">
        <SelectorFecha
          etiqueta="Acta de transparencia"
          valor={k.acta}
          onCambio={(acta) => guardarCompra({ acta })}
          opcional
          ayuda="Gratis, en persona y como tarde el día antes de firmar."
        />
        <SelectorFecha etiqueta="Firma en la notaría" valor={k.firma} onCambio={(firma) => guardarCompra({ firma })} opcional />
        <CampoTexto etiqueta="Notaría" valor={k.notaria} onGuardar={(notaria) => guardarCompra({ notaria })} placeholder="La eliges tú" />
      </Seccion>

      <Seccion titulo="Costes">
        <Ayuda>Lo estimado; cuando sepas lo que pagas de verdad, escríbelo y sustituye a la estimación.</Ayuda>
        {n.coste.lineas
          .filter((l) => l.clave !== 'precio')
          .map((l) => (
            <View key={l.clave} style={s.dos}>
              <View style={{ flex: 1 }}>
                <Text style={typo.cuerpo}>{l.nombre}</Text>
                <Text style={[typo.apoyo, { color: color.texto2 }]}>Estimado: {euros(l.importe)}</Text>
              </View>
              <View style={{ width: 132 }}>
                <CampoDinero
                  valor={k.reales[l.clave] ?? 0}
                  placeholder="Real"
                  onGuardar={(v) => {
                    const reales = { ...k.reales };
                    if (v) reales[l.clave] = v;
                    else delete reales[l.clave];
                    guardarCompra({ reales });
                  }}
                />
              </View>
            </View>
          ))}
        <Fila titulo="Total" derecha={euros(n.coste.total)} />
        <Fila titulo="De tus ahorros" subtitulo={`Tienes ${eurosRedondos(d.ajustes.ahorros)}`} derecha={euros(n.necesario)} tintoDerecha={n.falta ? color.acento : undefined} />
      </Seccion>

      {casa.estado === 'arras' && (
        <Boton
          texto="Ya es tuya"
          icono="key"
          onPress={() => {
            cambiarEstado(casa, 'comprada');
            avisar('¡Enhorabuena! Ahora toca lo de después de firmar.');
          }}
        />
      )}
    </>
  );
}

const s = StyleSheet.create({
  tres: { flexDirection: 'row', gap: espacio.md },
  tercio: { flex: 1 },
  dos: { flexDirection: 'row', gap: espacio.md, alignItems: 'center' },
  filaVisita: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, minHeight: TACTIL, borderBottomWidth: BORDE, borderBottomColor: color.linea },
  grupo: { color: color.texto2, textTransform: 'uppercase', marginTop: espacio.md, marginBottom: espacio.xs },
  revision: { flexDirection: 'row', alignItems: 'center', gap: espacio.sm, minHeight: TACTIL, borderBottomWidth: BORDE, borderBottomColor: color.linea },
  voto: { width: 44, height: 40, borderWidth: BORDE, borderColor: color.linea, borderRadius: RADIO, alignItems: 'center', justifyContent: 'center' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  miniatura: { width: 100, height: 100, borderRadius: RADIO, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imagen: { width: 100, height: 100 },
  visor: { flex: 1, backgroundColor: color.lineaFuerte, padding: espacio.pantalla, paddingTop: espacio.xxl * 2, gap: espacio.lg },
  botonVisor: { backgroundColor: color.fondo },
});
