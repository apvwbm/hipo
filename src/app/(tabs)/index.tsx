// Inicio = la guía. En qué fase estás (deducido de tus casas, empieces donde empieces),
// qué te toca hacer, qué viene y de qué tener cuidado. Todo derivado: aquí no se
// guarda nada salvo las marcas de las tareas.

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';

import { Boton, BotonIcono, Casilla, Cifra, Fila, Nota, Pantalla, Progreso, Seccion } from '@/components/ui';
import { useCapacidad, useGuia, useHoy } from '@/hooks';
import { FASES, type Tarea } from '@/lib/catalogo';
import { eurosRedondos } from '@/lib/dinero';
import { diasEntre, fechaCorta, fechaLarga, relativa } from '@/lib/fechas';
import type { EstadoTarea } from '@/lib/motor';
import { marcar } from '@/store/app';
import { color, typo } from '@/theme';

export default function Inicio() {
  const { x, fase, tareas, proximos, avisos } = useGuia();
  const cap = useCapacidad();
  const hoy = useHoy();
  const [antes, setAntes] = useState(false);
  const [todas, setTodas] = useState(false);
  const casa = x.compra;
  const k = casa?.compra;

  const irA = (ir: Tarea['ir'] | 'compra' | '/papeles' | '/ajustes') => {
    if (ir === 'compra') router.push(casa ? { pathname: '/casa/[id]', params: { id: casa.id, parte: 'compra' } } : '/casas');
    else if (ir === '/ajustes') router.push('/ajustes');
    else if (ir) router.push(ir);
  };

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
  const pendientesAntes = tareas.filter((t) => t.tarea.fase < fase && t.estado === 'pendiente');
  const hechas = deEsta.filter((t) => t.estado !== 'pendiente').length;

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
            texto={'HIPO te acompaña desde "quiero comprar" hasta las llaves. Todo lo que apuntas se queda en este móvil, cifrado: sin cuentas y sin internet.'}
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

      <Seccion titulo={`Fase ${fase} de 6 · ${FASES[fase - 1]}`} derecha={<Text style={[typo.micro, { color: color.texto2 }]}>{`${hechas} de ${deEsta.length}`}</Text>}>
        <Progreso hecho={hechas} total={deEsta.length} />
        {deEsta.map(casilla)}
        {pendientesAntes.length > 0 && (
          <>
            <Boton
              texto={`Te quedan ${pendientesAntes.length} de antes`}
              variante="texto"
              icono={antes ? 'chevron-up' : 'chevron-down'}
              onPress={() => setAntes(!antes)}
              style={{ alignSelf: 'flex-start' }}
            />
            {antes && pendientesAntes.map(casilla)}
          </>
        )}
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

      <Seccion>
        <Boton texto={todas ? 'Ocultar las demás fases' : 'Ver todas las fases'} variante="secundario" icono={todas ? 'chevron-up' : 'list'} onPress={() => setTodas(!todas)} />
      </Seccion>
      {todas &&
        FASES.map((nombre, i) =>
          i + 1 === fase ? null : (
            <Seccion key={nombre} titulo={`${i + 1} · ${nombre}`}>
              {tareas.filter((t) => t.tarea.fase === i + 1).map(casilla)}
            </Seccion>
          ),
        )}
    </Pantalla>
  );
}
