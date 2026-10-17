// Inicio = la guía, por fases. Arriba lo que toca ahora y un botón grande para dar el
// siguiente paso; lo ya hecho se pliega (pero se puede abrir) y lo que viene solo se
// nombra. La fase se deduce de tus datos: aquí no se guarda nada salvo las marcas.

import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Ayuda, Boton, BotonIcono, Casilla, Chip, Chips, Cifra, Fila, Nota, Pantalla, Progreso, Seccion } from '@/components/ui';
import { useCapacidad, useGuia, useHoy } from '@/hooks';
import { FASES, type Tarea } from '@/lib/catalogo';
import { eurosRedondos } from '@/lib/dinero';
import { diasEntre, fechaCorta, fechaLarga, relativa } from '@/lib/fechas';
import type { EstadoTarea, Paso } from '@/lib/motor';
import { avisar, cambiarEstado, firmarArras, marcar, useApp } from '@/store/app';
import { color, espacio, typo } from '@/theme';
import type { Casa } from '@/types';

export default function Inicio() {
  const { x, fase, siguiente, tareas, proximos, avisos } = useGuia();
  const cap = useCapacidad();
  const hoy = useHoy();
  const casas = useApp((s) => s.casas);
  const [antes, setAntes] = useState(false);
  const casa = x.compra;
  const k = casa?.compra;

  const verCompra = (c: Casa) => router.push({ pathname: '/casa/[id]', params: { id: c.id, parte: 'compra' } });
  const irA = (ir: Tarea['ir'] | '/papeles' | '/ajustes') => {
    if (ir === 'compra') return casa ? verCompra(casa) : router.push('/casas');
    if (ir) router.push(ir);
  };

  const dar = (paso: Paso) => {
    if (paso.accion === 'titular') return router.push('/titular');
    if (paso.accion === 'ahorros') return router.push('/hipoteca');
    if (paso.accion === 'nueva') return router.push('/nueva');
    if (paso.accion === 'ofertas') return router.push('/oferta');
    if (!casa) return;
    if (paso.accion === 'compra') return verCompra(casa);
    if (paso.accion === 'arras') {
      return Alert.alert('Arras firmadas', `¿Has firmado las arras de "${casa.nombre}"? Pasarás a conseguir la hipoteca.`, [
        { text: 'Todavía no', style: 'cancel' },
        {
          text: 'Sí',
          onPress: () => {
            firmarArras(casa);
            verCompra(casa);
          },
        },
      ]);
    }
    if (paso.accion === 'comprada') {
      Alert.alert('¡Ya es tuya!', `¿Has firmado la compra de "${casa.nombre}" en la notaría?`, [
        { text: 'Todavía no', style: 'cancel' },
        {
          text: 'Sí',
          onPress: () => {
            cambiarEstado(casa, 'comprada');
            avisar('¡Enhorabuena! Te quedan unos trámites de después.');
          },
        },
      ]);
    }
  };

  const elegir = (c: Casa) =>
    Alert.alert('Elegir casa', `¿Vas a por "${c.nombre}"? Aparecerán los pasos y papeles para reservarla.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Esta es',
        onPress: () => {
          cambiarEstado(c, 'oferta');
          verCompra(c);
        },
      },
    ]);

  const casilla = ({ tarea, estado, auto }: EstadoTarea) => (
    <Casilla
      key={tarea.clave}
      texto={tarea.texto}
      ayuda={tarea.ayuda}
      estado={estado}
      auto={auto}
      onPress={() => marcar(tarea.clave, estado === 'pendiente' ? 'hecho' : null)}
      onNoAplica={() => marcar(tarea.clave, estado === 'no-aplica' ? null : 'no-aplica')}
      onIr={tarea.ir ? () => irA(tarea.ir) : undefined}
    />
  );

  const deEsta = tareas.filter((t) => t.tarea.fase === fase);
  const anteriores = tareas.filter((t) => t.tarea.fase < fase);
  const pendientesAntes = anteriores.filter((t) => t.estado === 'pendiente').length;
  const hechas = deEsta.filter((t) => t.estado !== 'pendiente').length;
  const candidatas = casas.filter((c) => c.estado === 'interesa' || c.estado === 'finalista');

  return (
    <Pantalla titulo="HIPO" derecha={<BotonIcono icono="settings" etiqueta="Ajustes" onPress={() => router.push('/ajustes')} />}>
      <Seccion>
        {casa?.estado === 'comprada' ? (
          <Cifra heroe rotulo="Ya es tuya" valor={casa.nombre} apoyo="Te quedan los trámites de después de firmar." />
        ) : k?.firma && k.firma >= hoy ? (
          <Cifra heroe rotulo="Firma en la notaría" valor={k.firma === hoy ? 'Hoy' : `${diasEntre(hoy, k.firma)} días`} apoyo={fechaLarga(k.firma)} />
        ) : cap.precio > 0 ? (
          <Pressable onPress={() => router.push('/hipoteca')} accessibilityRole="button">
            <Cifra heroe rotulo="Puedes permitirte hasta" valor={eurosRedondos(cap.precio)} apoyo="Con tus ahorros e ingresos. Toca para ver el detalle." />
          </Pressable>
        ) : (
          <Nota
            icono="lock"
            texto={'HIPO te acompaña desde "quiero comprar" hasta las llaves, paso a paso. Todo lo que apuntas se queda en este móvil, cifrado: sin cuentas y sin internet.'}
          />
        )}
      </Seccion>

      {avisos.length > 0 && (
        <Seccion titulo="Ojo">
          {avisos.map((a) => (
            <Nota key={a.texto} tono={a.tono} texto={a.texto} accion={a.ir ? { texto: 'Ver', onPress: () => irA(a.ir) } : undefined} />
          ))}
        </Seccion>
      )}

      <Seccion
        titulo={`Fase ${fase} de ${FASES.length} · ${FASES[fase - 1]}`}
        derecha={<Text style={[typo.micro, { color: color.texto2 }]}>{`${hechas} de ${deEsta.length}`}</Text>}
      >
        <Progreso hecho={hechas} total={deEsta.length} />
        {siguiente?.accion === 'elegir' ? (
          <View style={s.paso}>
            <Text style={typo.cuerpo}>¿Ya tienes tu casa? Elígela:</Text>
            <Chips>
              {candidatas.map((c) => (
                <Chip key={c.id} texto={c.nombre} icono="home" activo={false} onPress={() => elegir(c)} />
              ))}
            </Chips>
          </View>
        ) : siguiente ? (
          <Boton texto={siguiente.texto} icono="arrow-right" onPress={() => dar(siguiente)} style={s.paso} />
        ) : null}
        {deEsta.map(casilla)}
      </Seccion>

      {proximos.length > 0 && (
        <Seccion titulo="Próximo">
          {proximos.slice(0, 8).map((p) => (
            <Fila
              key={`${p.fecha}${p.texto}${p.detalle ?? ''}`}
              titulo={p.texto}
              subtitulo={p.detalle}
              derecha={fechaCorta(p.fecha, hoy)}
              subderecha={relativa(p.fecha, hoy)}
              tintoDerecha={diasEntre(hoy, p.fecha) <= 3 ? color.acento : undefined}
              onPress={p.casaId ? () => router.push(`/casa/${p.casaId}`) : p.papeles ? () => router.push('/papeles') : undefined}
            />
          ))}
        </Seccion>
      )}

      {fase > 1 && (
        <Seccion>
          <Boton
            texto={`Fases anteriores${pendientesAntes ? ` · ${pendientesAntes} sin hacer` : ''}`}
            variante="texto"
            icono={antes ? 'chevron-up' : 'chevron-down'}
            onPress={() => setAntes(!antes)}
            style={{ alignSelf: 'flex-start' }}
          />
          {antes &&
            FASES.slice(0, fase - 1).map((nombre, i) => (
              <View key={nombre}>
                <Text style={[typo.micro, s.fase]}>{`${i + 1} · ${nombre}`}</Text>
                {anteriores.filter((t) => t.tarea.fase === i + 1).map(casilla)}
              </View>
            ))}
        </Seccion>
      )}

      {fase < FASES.length && (
        <Seccion titulo="Lo que viene">
          <Ayuda>{FASES.slice(fase).map((nombre, i) => `${fase + i + 1} · ${nombre}`).join('   ')}</Ayuda>
        </Seccion>
      )}
    </Pantalla>
  );
}

const s = StyleSheet.create({
  paso: { marginVertical: espacio.sm, gap: espacio.sm },
  fase: { color: color.texto2, textTransform: 'uppercase', marginTop: espacio.md, marginBottom: espacio.xs },
});
