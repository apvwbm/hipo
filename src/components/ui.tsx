// Primitivas de interfaz compartidas. Todas pequeñas y sin estado propio salvo lo
// imprescindible; las pantallas se componen con esto y casi nada más.

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { aTexto, aTextoPct, parseImporte, parsePct } from '@/lib/dinero';
import { addDias, DIAS, desdeISO, diaSemana, diasDelMes, fecha, fechaCorta, hoyISO, nombreMes } from '@/lib/fechas';
import { cerrarAviso, useApp } from '@/store/app';
import { BORDE, color, espacio, RADIO, TACTIL, typo } from '@/theme';

export type NombreIcono = ComponentProps<typeof Feather>['name'];

export const Icono = ({ nombre, tam = 20, tinte = color.texto }: { nombre: string; tam?: number; tinte?: string }) => (
  <Feather name={nombre as NombreIcono} size={tam} color={tinte} />
);

// ── Pantalla ─────────────────────────────────────────────────────────────────

export function Pantalla({
  titulo,
  atras,
  derecha,
  pie,
  scroll = true,
  children,
}: {
  titulo?: string;
  atras?: boolean;
  derecha?: ReactNode;
  pie?: ReactNode;
  scroll?: boolean;
  children: ReactNode;
}) {
  const cabecera = (titulo || atras || derecha) && (
    <View style={s.cabecera}>
      {atras && (
        <Pressable onPress={() => router.back()} hitSlop={8} style={s.atras} accessibilityRole="button" accessibilityLabel="Atrás">
          <Icono nombre="arrow-left" tam={22} />
        </Pressable>
      )}
      <Text style={[typo.titulo, s.titulo]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} accessibilityRole="header">
        {titulo}
      </Text>
      {derecha}
    </View>
  );
  return (
    // Con pie (formularios fuera de las pestañas) se respeta también el borde inferior:
    // si no, el botón de guardar queda debajo de la barra de gestos.
    <SafeAreaView style={s.pantalla} edges={pie ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}>
      {/* Con edge-to-edge Android ya no redimensiona la ventana al abrir el teclado: sin
          esto, el teclado tapa los últimos campos y el pie. Al encogerse, el ScrollView
          nativo desplaza solo hasta el campo enfocado. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        {cabecera}
        {scroll ? (
          <ScrollView contentContainerStyle={s.contenido} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[s.contenido, { flex: 1 }]}>{children}</View>
        )}
        {pie && <View style={s.pie}>{pie}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Seccion({ titulo, derecha, children, style }: { titulo?: string; derecha?: ReactNode; children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[s.seccion, style]}>
      {(titulo || derecha) && (
        <View style={s.seccionCabecera}>
          <Text style={[typo.seccion, { color: color.texto2, flex: 1 }]} accessibilityRole="header">
            {titulo}
          </Text>
          {derecha}
        </View>
      )}
      {children}
    </View>
  );
}

export const Ayuda = ({ children, tono = color.texto2 }: { children: ReactNode; tono?: string }) => (
  <Text style={[typo.apoyo, { color: tono, marginTop: espacio.xs }]}>{children}</Text>
);

/** Cifra grande con su rótulo encima y una línea de apoyo debajo. */
export function Cifra({ rotulo, valor, apoyo, heroe }: { rotulo: string; valor: string; apoyo?: string; heroe?: boolean }) {
  return (
    <View>
      <Text style={[typo.micro, { color: color.texto2, textTransform: 'uppercase' }]}>{rotulo}</Text>
      <Text style={[heroe ? typo.heroe : typo.cifra, { color: heroe ? color.acento : color.texto }]} adjustsFontSizeToFit numberOfLines={1}>
        {valor}
      </Text>
      {apoyo ? <Ayuda>{apoyo}</Ayuda> : null}
    </View>
  );
}

// ── Botones ──────────────────────────────────────────────────────────────────

type Variante = 'principal' | 'secundario' | 'texto' | 'peligro';

export function Boton({
  texto,
  onPress,
  variante = 'principal',
  icono,
  deshabilitado,
  style,
}: {
  texto: string;
  onPress: () => void;
  variante?: Variante;
  icono?: string;
  deshabilitado?: boolean;
  style?: ViewStyle;
}) {
  const relleno = variante === 'principal';
  const tinte = relleno ? color.sobreAcento : variante === 'peligro' ? color.acento : color.texto;
  return (
    <Pressable
      onPress={onPress}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityState={{ disabled: deshabilitado }}
      style={({ pressed }) => [
        s.boton,
        relleno && { backgroundColor: color.acento },
        (variante === 'secundario' || variante === 'peligro') && { borderWidth: BORDE, borderColor: variante === 'peligro' ? color.acento : color.lineaFuerte },
        variante === 'texto' && { minHeight: 40, paddingHorizontal: 0 },
        (pressed || deshabilitado) && { opacity: deshabilitado ? 0.4 : 0.75 },
        style,
      ]}
    >
      {icono && <Icono nombre={icono} tam={18} tinte={tinte} />}
      <Text style={[typo.cuerpo, { color: tinte }]}>{texto}</Text>
    </Pressable>
  );
}

/** Icono tocable de 48 × 48 para las cabeceras y las filas. */
export const BotonIcono = ({ icono, onPress, etiqueta, tinte }: { icono: string; onPress: () => void; etiqueta: string; tinte?: string }) => (
  <Pressable onPress={onPress} style={s.botonIcono} hitSlop={4} accessibilityRole="button" accessibilityLabel={etiqueta}>
    <Icono nombre={icono} tam={20} tinte={tinte} />
  </Pressable>
);

// ── Campos ───────────────────────────────────────────────────────────────────

export function Campo({ etiqueta, ayuda, error, ...props }: TextInputProps & { etiqueta?: string; ayuda?: string; error?: string | null }) {
  return (
    <View style={s.campo}>
      {etiqueta && <Text style={[typo.micro, { color: color.texto2, marginBottom: espacio.xs }]}>{etiqueta}</Text>}
      <TextInput
        placeholderTextColor={color.texto3}
        accessibilityLabel={etiqueta}
        {...props}
        style={[typo.cuerpo, s.input, props.multiline && s.multilinea, error ? { borderColor: color.acento } : null, props.style]}
      />
      {error ? <Ayuda tono={color.acento}>{error}</Ayuda> : ayuda ? <Ayuda>{ayuda}</Ayuda> : null}
    </View>
  );
}

/**
 * Campo con valor tipado que guarda EN CADA TECLA válida. No espera a salir del foco:
 * tocar "Guardar" o volver atrás con el teclado abierto no dispara `onBlur`, y lo
 * escrito se perdería. Guardar "1", "15" y "150" de camino no cuesta nada aquí (no hay
 * cálculos caros detrás). Mientras se edita se respeta lo escrito tal cual; al salir,
 * se reformatea, y si no es válido se avisa.
 */
function CampoValor<T>({
  valor,
  onGuardar,
  aTextoValor,
  leer,
  error,
  ...props
}: Omit<TextInputProps, 'value'> & {
  valor: T;
  onGuardar: (v: T) => void;
  aTextoValor: (v: T) => string;
  /** null = no válido. */
  leer: (texto: string) => T | null;
  error: string;
  etiqueta?: string;
  ayuda?: string;
}) {
  const [texto, setTexto] = useState<string | null>(null);
  const [mal, setMal] = useState(false);
  return (
    <Campo
      {...props}
      error={mal ? error : null}
      value={texto ?? aTextoValor(valor)}
      onChangeText={(t) => {
        setTexto(t);
        const v = leer(t);
        if (v !== null && v !== valor) onGuardar(v);
      }}
      onBlur={() => {
        if (texto === null) return;
        const v = leer(texto);
        setMal(v === null);
        if (v !== null) setTexto(null);
      }}
    />
  );
}

type PropsValor<T> = { valor: T; onGuardar: (v: T) => void; etiqueta?: string; ayuda?: string; placeholder?: string };

/** Importe en céntimos; vacío = 0. */
export const CampoDinero = (p: PropsValor<number>) => (
  <CampoValor<number>
    {...p}
    aTextoValor={(v) => (v ? aTexto(v) : '')}
    leer={(t) => (t.trim() ? parseImporte(t) : 0)}
    error="Escribe un importe válido."
    keyboardType="decimal-pad"
    placeholder={p.placeholder ?? '0 €'}
    selectTextOnFocus
  />
);

/** Porcentaje en milésimas de punto (2,85 % → 2850); vacío = 0. */
export const CampoPct = (p: PropsValor<number>) => (
  <CampoValor<number>
    {...p}
    aTextoValor={(v) => (v ? aTextoPct(v) : '')}
    leer={(t) => (t.trim() ? parsePct(t) : 0)}
    error="Escribe un porcentaje como 2,85."
    keyboardType="decimal-pad"
    placeholder={p.placeholder ?? '0 %'}
    selectTextOnFocus
  />
);

/** Entero (m², año…); vacío = 0. */
export const CampoEntero = (p: PropsValor<number>) => (
  <CampoValor<number>
    {...p}
    aTextoValor={(v) => (v ? String(v) : '')}
    leer={(t) => (t.trim() ? (/^\d+$/.test(t.trim()) ? Number(t.trim()) : null) : 0)}
    error="Escribe un número entero."
    keyboardType="number-pad"
    placeholder={p.placeholder ?? '—'}
    selectTextOnFocus
  />
);

export const CampoTexto = (p: PropsValor<string> & { multiline?: boolean; keyboardType?: TextInputProps['keyboardType']; autoCapitalize?: TextInputProps['autoCapitalize'] }) => (
  <CampoValor<string> {...p} aTextoValor={(v) => v} leer={(t) => t.trim()} error="" />
);

export function Segmentado<V extends string | number>({
  opciones,
  valor,
  onCambio,
  etiqueta,
}: {
  opciones: { valor: V; texto: string }[];
  valor: V;
  onCambio: (v: V) => void;
  etiqueta?: string;
}) {
  return (
    <View style={s.campo}>
      {etiqueta && <Text style={[typo.micro, { color: color.texto2, marginBottom: espacio.xs }]}>{etiqueta}</Text>}
      <View style={s.segmentado} accessibilityRole="radiogroup">
        {opciones.map((o) => {
          const activo = o.valor === valor;
          return (
            <Pressable
              key={String(o.valor)}
              onPress={() => onCambio(o.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activo }}
              style={[s.segmento, activo && { backgroundColor: color.lineaFuerte }]}
            >
              <Text style={[typo.micro, { color: activo ? color.fondo : color.texto, textAlign: 'center' }]} numberOfLines={2}>
                {o.texto}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Interruptor({ titulo, ayuda, valor, onCambio }: { titulo: string; ayuda?: string; valor: boolean; onCambio: (v: boolean) => void }) {
  return (
    <View style={s.fila}>
      <View style={{ flex: 1 }}>
        <Text style={typo.cuerpo}>{titulo}</Text>
        {ayuda && <Ayuda>{ayuda}</Ayuda>}
      </View>
      <Switch
        value={valor}
        onValueChange={onCambio}
        accessibilityLabel={titulo}
        trackColor={{ true: color.verde, false: color.linea }}
        thumbColor={color.fondo}
      />
    </View>
  );
}

/** − valor + con zonas táctiles completas. */
export function Pasos({
  etiqueta,
  texto,
  onMenos,
  onMas,
  onTexto,
  ayuda,
}: {
  etiqueta: string;
  texto: string;
  onMenos: () => void;
  onMas: () => void;
  /** Si se pasa, el valor del centro también se puede tocar. */
  onTexto?: () => void;
  ayuda?: string;
}) {
  return (
    <View style={s.campo}>
      <View style={s.fila}>
        <Text style={[typo.cuerpo, { flex: 1 }]}>{etiqueta}</Text>
        <Pressable onPress={onMenos} style={s.paso} accessibilityRole="button" accessibilityLabel={`${etiqueta} −`}>
          <Icono nombre="minus" />
        </Pressable>
        <Pressable onPress={onTexto} disabled={!onTexto} style={s.valorPaso} accessibilityRole={onTexto ? 'button' : 'text'}>
          <Text style={[typo.dato, { textAlign: 'center' }, onTexto && s.subrayado]}>{texto}</Text>
        </Pressable>
        <Pressable onPress={onMas} style={s.paso} accessibilityRole="button" accessibilityLabel={`${etiqueta} +`}>
          <Icono nombre="plus" />
        </Pressable>
      </View>
      {ayuda && <Ayuda>{ayuda}</Ayuda>}
    </View>
  );
}

/**
 * Fecha opcional: ‹ fecha › de día en día y, tocándola, un calendario para saltos
 * largos (hecho con Views, sin librería). Sin fecha, un botón para ponerla.
 */
export function SelectorFecha({
  valor,
  onCambio,
  etiqueta,
  ayuda,
  opcional,
}: {
  valor: string | null;
  onCambio: (iso: string | null) => void;
  etiqueta: string;
  ayuda?: string;
  opcional?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const hoy = hoyISO();
  const calendario = abierto && (
    <Calendario
      valor={valor ?? hoy}
      onElegir={(iso) => {
        onCambio(iso);
        setAbierto(false);
      }}
      onCerrar={() => setAbierto(false)}
    />
  );
  if (!valor) {
    return (
      <View style={s.campo}>
        <View style={s.fila}>
          <Text style={[typo.cuerpo, { flex: 1 }]}>{etiqueta}</Text>
          <Boton texto="Poner fecha" variante="secundario" icono="calendar" onPress={() => setAbierto(true)} />
        </View>
        {ayuda && <Ayuda>{ayuda}</Ayuda>}
        {calendario}
      </View>
    );
  }
  return (
    <View style={s.campo}>
      <Pasos
        etiqueta={etiqueta}
        texto={valor === hoy ? 'Hoy' : fechaCorta(valor, hoy)}
        onMenos={() => onCambio(addDias(valor, -1))}
        onMas={() => onCambio(addDias(valor, 1))}
        onTexto={() => setAbierto(true)}
      />
      {opcional && <Boton texto="Quitar fecha" variante="texto" onPress={() => onCambio(null)} style={{ alignSelf: 'flex-end', minHeight: 32 }} />}
      {ayuda && <Ayuda>{ayuda}</Ayuda>}
      {calendario}
    </View>
  );
}

function Calendario({ valor, onElegir, onCerrar }: { valor: string; onElegir: (iso: string) => void; onCerrar: () => void }) {
  const [visto, setVisto] = useState(() => {
    const d = desdeISO(valor);
    return { anio: d.getFullYear(), mes: d.getMonth() };
  });
  const hoy = hoyISO();
  const primero = fecha(visto.anio, visto.mes, 1);
  // Huecos hasta el día de la semana del 1 (la semana empieza en lunes).
  const celdas: (string | null)[] = [
    ...Array<null>(diaSemana(primero) - 1).fill(null),
    ...Array.from({ length: diasDelMes(visto.anio, visto.mes) }, (_, i) => fecha(visto.anio, visto.mes, i + 1)),
  ];
  const mover = (delta: number) => {
    const d = new Date(visto.anio, visto.mes + delta, 1);
    setVisto({ anio: d.getFullYear(), mes: d.getMonth() });
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onCerrar} statusBarTranslucent>
      <Pressable style={s.velo} onPress={onCerrar} accessibilityLabel="Cancelar">
        <Pressable style={s.calendario} onPress={() => {}}>
          <View style={s.fila}>
            <Pressable onPress={() => mover(-1)} style={s.paso} accessibilityRole="button" accessibilityLabel="Mes anterior">
              <Icono nombre="chevron-left" />
            </Pressable>
            <Text style={[typo.cuerpo, { flex: 1, textAlign: 'center' }]}>
              {nombreMes(visto.mes).replace(/^./, (l) => l.toUpperCase())} {visto.anio}
            </Text>
            <Pressable onPress={() => mover(1)} style={s.paso} accessibilityRole="button" accessibilityLabel="Mes siguiente">
              <Icono nombre="chevron-right" />
            </Pressable>
          </View>
          <View style={s.semana}>
            {DIAS.map((d) => (
              <Text key={d} style={[typo.micro, s.celdaTexto, { color: color.texto3 }]}>
                {d[0].toUpperCase()}
              </Text>
            ))}
          </View>
          <View style={s.semana}>
            {celdas.map((iso, i) => {
              if (!iso) return <View key={`h${i}`} style={s.celda} />;
              const elegido = iso === valor;
              return (
                <Pressable
                  key={iso}
                  onPress={() => onElegir(iso)}
                  style={[s.celda, elegido && { backgroundColor: color.acento }, iso === hoy && !elegido && s.celdaHoy]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: elegido }}
                  accessibilityLabel={iso}
                >
                  <Text style={[typo.dato, { color: elegido ? color.sobreAcento : color.texto }]}>{Number(iso.slice(8))}</Text>
                </Pressable>
              );
            })}
          </View>
          <Boton texto="Hoy" variante="texto" onPress={() => onElegir(hoy)} style={{ alignSelf: 'center' }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Chip({ texto, icono, activo, onPress }: { texto: string; icono?: string; activo: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: activo }}
      style={[s.chip, activo && { borderColor: color.lineaFuerte, backgroundColor: color.superficie }]}
    >
      {icono && <Icono nombre={icono} tam={16} />}
      <Text style={[typo.micro, { color: color.texto }]} numberOfLines={1}>
        {texto}
      </Text>
    </Pressable>
  );
}

export const Chips = ({ children }: { children: ReactNode }) => <View style={s.chips}>{children}</View>;

// ── Filas y estados ──────────────────────────────────────────────────────────

export function Fila({
  titulo,
  subtitulo,
  derecha,
  subderecha,
  icono,
  tinteIcono,
  onPress,
  chevron,
  tintoDerecha,
}: {
  titulo: string;
  subtitulo?: string;
  derecha?: string;
  subderecha?: string;
  icono?: string;
  tinteIcono?: string;
  onPress?: () => void;
  chevron?: boolean;
  tintoDerecha?: string;
}) {
  const contenido = (
    <>
      {icono && (
        <View style={s.iconoFila}>
          <Icono nombre={icono} tam={18} tinte={tinteIcono} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={typo.cuerpo} numberOfLines={2}>
          {titulo}
        </Text>
        {subtitulo ? (
          <Text style={[typo.apoyo, { color: color.texto2 }]} numberOfLines={2}>
            {subtitulo}
          </Text>
        ) : null}
      </View>
      {(derecha || subderecha) && (
        <View style={{ alignItems: 'flex-end' }}>
          {derecha ? <Text style={[typo.dato, { color: tintoDerecha ?? color.texto }]}>{derecha}</Text> : null}
          {subderecha ? <Text style={[typo.apoyo, { color: color.texto2 }]}>{subderecha}</Text> : null}
        </View>
      )}
      {chevron && <Icono nombre="chevron-right" tam={18} tinte={color.texto3} />}
    </>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.fila, s.filaBorde, pressed && { backgroundColor: color.superficie }]}>
      {contenido}
    </Pressable>
  ) : (
    <View style={[s.fila, s.filaBorde]}>{contenido}</View>
  );
}

/**
 * Casilla de una tarea. "Hecha sola" (deducida de los datos) no se desmarca a mano.
 * La explicación se despliega tocando el icono de información.
 */
export function Casilla({
  texto,
  ayuda,
  estado,
  auto,
  onPress,
  onIr,
  onNoAplica,
}: {
  texto: string;
  ayuda?: string;
  estado: 'hecha' | 'pendiente' | 'no-aplica';
  auto?: boolean;
  onPress: () => void;
  onIr?: () => void;
  /** Marca (o desmarca) "no me hace falta"; aparece al desplegar. */
  onNoAplica?: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const icono = estado === 'hecha' ? 'check-square' : estado === 'no-aplica' ? 'minus-square' : 'square';
  const apagada = estado !== 'pendiente';
  return (
    <View style={s.filaBorde}>
      <View style={s.fila}>
        <Pressable
          onPress={onPress}
          disabled={auto}
          style={s.casilla}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: estado === 'hecha', disabled: auto }}
          accessibilityLabel={texto}
        >
          <Icono nombre={icono} tinte={estado === 'hecha' ? color.verde : color.texto2} />
        </Pressable>
        <Pressable onPress={onIr ?? (() => setAbierta(!abierta))} style={{ flex: 1, paddingVertical: espacio.sm }} accessibilityRole="button">
          <Text style={[typo.texto, { color: apagada ? color.texto2 : color.texto }, estado === 'no-aplica' && s.tachado]}>{texto}</Text>
          {auto && estado === 'hecha' && <Text style={[typo.micro, { color: color.verde }]}>Hecho</Text>}
          {estado === 'no-aplica' && <Text style={[typo.micro, { color: color.texto3 }]}>No me hace falta</Text>}
        </Pressable>
        {(ayuda || (onNoAplica && !auto)) && (
          <BotonIcono icono={abierta ? 'chevron-up' : ayuda ? 'info' : 'more-horizontal'} etiqueta="Más" tinte={color.texto3} onPress={() => setAbierta(!abierta)} />
        )}
      </View>
      {abierta && (
        <View style={s.explicacion}>
          {ayuda && <Text style={[typo.apoyo, { color: color.texto2 }]}>{ayuda}</Text>}
          {onNoAplica && !auto && estado !== 'hecha' && (
            <Boton
              texto={estado === 'no-aplica' ? 'Sí me hace falta' : 'No me hace falta'}
              variante="texto"
              onPress={onNoAplica}
              style={{ alignSelf: 'flex-start', minHeight: 36 }}
            />
          )}
        </View>
      )}
    </View>
  );
}

export function Nota({ texto, tono = 'neutro', icono, accion }: { texto: string; tono?: 'neutro' | 'aviso' | 'peligro' | 'bien'; icono?: string; accion?: { texto: string; onPress: () => void } }) {
  const tonos = {
    neutro: [color.superficie, color.texto2, 'info'],
    aviso: [color.ocreSuave, color.ocre, 'alert-circle'],
    peligro: [color.acentoSuave, color.acento, 'alert-triangle'],
    bien: [color.verdeSuave, color.verde, 'check-circle'],
  } as const;
  const [fondo, tinte, iconoTono] = tonos[tono];
  return (
    <View style={[s.nota, { backgroundColor: fondo }]} accessibilityRole={tono === 'neutro' ? undefined : 'alert'}>
      <Icono nombre={icono ?? iconoTono} tam={18} tinte={tinte} />
      <View style={{ flex: 1, gap: espacio.sm }}>
        <Text style={[typo.apoyo, { color: color.texto }]}>{texto}</Text>
        {accion && <Boton texto={accion.texto} onPress={accion.onPress} variante="texto" style={{ alignSelf: 'flex-start', minHeight: 32 }} />}
      </View>
    </View>
  );
}

export function Vacio({ texto, cta, onPress }: { texto: string; cta?: string; onPress?: () => void }) {
  return (
    <View style={s.vacio}>
      <Text style={[typo.texto, { color: color.texto2, textAlign: 'center' }]}>{texto}</Text>
      {cta && onPress && <Boton texto={cta} onPress={onPress} variante="secundario" icono="plus" style={{ alignSelf: 'stretch' }} />}
    </View>
  );
}

/** Barra de progreso fina. El número va siempre en texto al lado. */
export function Progreso({ hecho, total }: { hecho: number; total: number }) {
  const pct = total ? Math.min(1, hecho / total) : 0;
  return (
    <View style={s.barraFondo} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: hecho }}>
      <View style={[s.barraRelleno, { width: `${Math.round(pct * 100)}%` }]} />
    </View>
  );
}

/** El aviso flotante con "deshacer". Uno a la vez; el nuevo sustituye al anterior. */
export function AvisoFlotante() {
  const aviso = useApp((s) => s.aviso);
  useEffect(() => {
    if (!aviso) return;
    const id = setTimeout(cerrarAviso, 4000);
    return () => clearTimeout(id);
  }, [aviso]);
  if (!aviso) return null;
  return (
    <View style={s.aviso} accessibilityLiveRegion="polite" pointerEvents="box-none">
      <Text style={[typo.apoyo, { color: color.fondo, flex: 1, paddingVertical: espacio.sm }]}>{aviso.texto}</Text>
      {aviso.deshacer && (
        <Pressable
          onPress={() => {
            aviso.deshacer?.();
            cerrarAviso();
          }}
          style={s.avisoBoton}
          accessibilityRole="button"
        >
          <Text style={[typo.micro, { color: color.fondo, textTransform: 'uppercase' }]}>Deshacer</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: color.fondo },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.md,
    paddingHorizontal: espacio.pantalla,
    paddingTop: espacio.lg,
    paddingBottom: espacio.md,
  },
  atras: { width: 32, height: TACTIL, justifyContent: 'center' },
  titulo: { flex: 1, color: color.texto },
  contenido: { paddingHorizontal: espacio.pantalla, paddingBottom: espacio.xxl * 3, gap: espacio.xl },
  pie: { paddingHorizontal: espacio.pantalla, paddingVertical: espacio.md, borderTopWidth: BORDE, borderTopColor: color.linea, backgroundColor: color.fondo },
  seccion: { gap: espacio.sm },
  seccionCabecera: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  boton: {
    minHeight: TACTIL,
    borderRadius: RADIO,
    paddingHorizontal: espacio.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: espacio.sm,
  },
  botonIcono: { width: TACTIL, height: TACTIL, alignItems: 'center', justifyContent: 'center' },
  campo: { gap: 0 },
  input: { minHeight: TACTIL, borderWidth: BORDE, borderColor: color.linea, borderRadius: RADIO, paddingHorizontal: espacio.md, color: color.texto },
  multilinea: { minHeight: 96, paddingVertical: espacio.sm, textAlignVertical: 'top' },
  segmentado: { flexDirection: 'row', borderWidth: BORDE, borderColor: color.lineaFuerte, borderRadius: RADIO, overflow: 'hidden' },
  segmento: { flex: 1, minHeight: 40, justifyContent: 'center', paddingHorizontal: espacio.xs },
  fila: { flexDirection: 'row', alignItems: 'center', gap: espacio.md, minHeight: TACTIL },
  filaBorde: { borderBottomWidth: BORDE, borderBottomColor: color.linea, paddingVertical: espacio.xs },
  iconoFila: { width: 36, height: 36, borderRadius: RADIO, backgroundColor: color.superficie, alignItems: 'center', justifyContent: 'center' },
  valorPaso: { minWidth: 64, minHeight: TACTIL, justifyContent: 'center', paddingHorizontal: espacio.xs },
  subrayado: { textDecorationLine: 'underline' },
  tachado: { textDecorationLine: 'line-through' },
  casilla: { width: TACTIL - 8, height: TACTIL, justifyContent: 'center' },
  explicacion: { paddingLeft: TACTIL - 8 + espacio.md, paddingBottom: espacio.sm, paddingRight: espacio.sm },
  velo: { flex: 1, backgroundColor: color.velo, justifyContent: 'center', padding: espacio.pantalla },
  calendario: { backgroundColor: color.fondo, borderRadius: RADIO, padding: espacio.md, gap: espacio.sm },
  semana: { flexDirection: 'row', flexWrap: 'wrap' },
  celda: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: RADIO },
  celdaHoy: { borderWidth: BORDE, borderColor: color.lineaFuerte },
  celdaTexto: { width: `${100 / 7}%`, textAlign: 'center' },
  paso: { width: TACTIL, height: TACTIL, borderWidth: BORDE, borderColor: color.linea, borderRadius: RADIO, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: espacio.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: espacio.xs,
    minHeight: 40,
    paddingHorizontal: espacio.md,
    borderWidth: BORDE,
    borderColor: color.linea,
    borderRadius: RADIO,
  },
  nota: { flexDirection: 'row', gap: espacio.md, padding: espacio.md, borderRadius: RADIO },
  vacio: { alignItems: 'center', gap: espacio.lg, paddingVertical: espacio.xxl },
  barraFondo: { height: 6, backgroundColor: color.linea, borderRadius: 1, overflow: 'hidden' },
  barraRelleno: { height: 6, backgroundColor: color.verde },
  aviso: {
    position: 'absolute',
    left: espacio.pantalla,
    right: espacio.pantalla,
    bottom: 96,
    backgroundColor: color.lineaFuerte,
    borderRadius: RADIO,
    paddingLeft: espacio.lg,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TACTIL,
  },
  avisoBoton: { minHeight: TACTIL, justifyContent: 'center', paddingHorizontal: espacio.lg },
});
