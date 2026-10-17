// Las casas candidatas. Cada fila ya enseña precio, coste total y cuota, y la lista se
// ordena por lo que importe: ordenada, ES el comparador.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { Boton, Chip, Chips, Fila, Pantalla, Seccion, Vacio } from '@/components/ui';
import { useNumeros } from '@/hooks';
import { ESTADOS } from '@/lib/catalogo';
import { euros, eurosRedondos } from '@/lib/dinero';
import { useApp } from '@/store/app';
import { color } from '@/theme';
import type { Casa } from '@/types';

type Orden = 'reciente' | 'precio' | 'coste' | 'm2' | 'cuota' | 'puntos';
const ORDENES: { valor: Orden; texto: string }[] = [
  { valor: 'reciente', texto: 'Recientes' },
  { valor: 'coste', texto: 'Coste total' },
  { valor: 'cuota', texto: 'Cuota' },
  { valor: 'precio', texto: 'Precio' },
  { valor: 'm2', texto: '€/m²' },
  { valor: 'puntos', texto: 'Puntuación' },
];

export default function PantallaCasas() {
  const casas = useApp((s) => s.casas);
  const numeros = useNumeros();
  const [orden, setOrden] = useState<Orden>('reciente');
  const [zona, setZona] = useState<string | null>(null);
  const [verDescartadas, setVerDescartadas] = useState(false);

  const zonas = useMemo(() => [...new Set(casas.filter((c) => c.estado !== 'descartada' && c.zona).map((c) => c.zona))].sort(), [casas]);
  const { activas, descartadas } = useMemo(() => {
    const clave = (c: Casa): number => {
      const n = numeros.get(c.id)!;
      if (orden === 'precio') return n.coste.precio;
      if (orden === 'coste') return n.coste.total;
      if (orden === 'cuota') return n.cuota;
      if (orden === 'm2') return c.m2 ? n.coste.precio / c.m2 : Number.MAX_SAFE_INTEGER;
      if (orden === 'puntos') return -c.puntos;
      return 0;
    };
    // `sort` es estable: con 'reciente' se queda el orden de carga (la más nueva arriba).
    const visibles = casas.filter((c) => !zona || c.zona === zona).sort((a, b) => clave(a) - clave(b));
    return { activas: visibles.filter((c) => c.estado !== 'descartada'), descartadas: visibles.filter((c) => c.estado === 'descartada') };
  }, [casas, numeros, orden, zona]);

  const fila = (c: Casa) => {
    const n = numeros.get(c.id)!;
    const datos = [
      ESTADOS.find((e) => e.valor === c.estado)?.texto,
      c.zona,
      c.m2 ? `${c.m2} m²` : '',
      c.habitaciones ? `${c.habitaciones} hab.` : '',
      c.puntos ? `${c.puntos}/5` : '',
    ].filter(Boolean);
    return (
      <Fila
        key={c.id}
        titulo={c.nombre}
        subtitulo={`${datos.join(' · ')}\nTotal ${eurosRedondos(n.coste.total)} · ${euros(n.cuota)}/mes`}
        derecha={eurosRedondos(n.coste.precio)}
        subderecha={c.m2 ? `${euros(Math.round(n.coste.precio / c.m2 / 100) * 100)}/m²` : undefined}
        tintoDerecha={c.estado === 'descartada' ? color.texto3 : undefined}
        onPress={() => router.push(`/casa/${c.id}`)}
        chevron
      />
    );
  };

  return (
    <Pantalla titulo="Casas" derecha={casas.length > 0 ? <Boton texto="Casa" icono="plus" variante="secundario" onPress={() => router.push('/nueva')} /> : undefined}>
      {casas.length === 0 ? (
        <Vacio
          texto="Apunta las casas que te interesen. Con su precio, la app calcula lo que te cuesta de verdad: impuestos, gastos, entrada y cuota."
          cta="Añadir casa"
          onPress={() => router.push('/nueva')}
        />
      ) : (
        <>
          <Seccion titulo="Ordenar">
            <Chips>
              {ORDENES.map((o) => (
                <Chip key={o.valor} texto={o.texto} activo={orden === o.valor} onPress={() => setOrden(o.valor)} />
              ))}
            </Chips>
          </Seccion>
          {zonas.length > 1 && (
            <Seccion titulo="Zona">
              <Chips>
                <Chip texto="Todas" activo={!zona} onPress={() => setZona(null)} />
                {zonas.map((z) => (
                  <Chip key={z} texto={z} activo={zona === z} onPress={() => setZona(zona === z ? null : z)} />
                ))}
              </Chips>
            </Seccion>
          )}
          <Seccion>{activas.map(fila)}</Seccion>
          {descartadas.length > 0 && (
            <Seccion>
              <Boton
                texto={`Descartadas (${descartadas.length})`}
                variante="texto"
                icono={verDescartadas ? 'chevron-up' : 'chevron-down'}
                onPress={() => setVerDescartadas(!verDescartadas)}
                style={{ alignSelf: 'flex-start' }}
              />
              {verDescartadas && descartadas.map(fila)}
            </Seccion>
          )}
        </>
      )}
    </Pantalla>
  );
}
