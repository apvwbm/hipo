// Hooks de lectura: todo lo derivado del store.
//
// Las pantallas no calculan nada: sacan de aquí el estado ya derivado. Cada derivado
// está memoizado sobre las porciones del store de las que depende.
//
// OJO (zustand 5): un selector que devuelve un array u objeto NUEVO (`s.casas.filter(…)`)
// provoca un bucle infinito de renders. Se selecciona la lista y se deriva en `useMemo`.

import { useMemo } from 'react';

import {
  avisos,
  capacidad,
  contexto,
  faseActual,
  numerosCasa,
  ordenarHipotecas,
  papeles,
  proximos,
  siguientePaso,
  tareas,
} from '@/lib/motor';
import { useApp } from '@/store/app';
import type { Casa, Datos } from '@/types';

export function useDatos(): Datos {
  const casas = useApp((s) => s.casas);
  const hipotecas = useApp((s) => s.hipotecas);
  const archivos = useApp((s) => s.archivos);
  const titulares = useApp((s) => s.titulares);
  const marcas = useApp((s) => s.marcas);
  const ajustes = useApp((s) => s.ajustes);
  return useMemo(() => ({ casas, hipotecas, archivos, titulares, marcas, ajustes }), [casas, hipotecas, archivos, titulares, marcas, ajustes]);
}

export const useHoy = () => useApp((s) => s.hoy);

/** La guía entera: casa en compra, fase, siguiente paso, papeles, tareas, próximos y avisos. */
export function useGuia() {
  const d = useDatos();
  const hoy = useHoy();
  return useMemo(() => {
    const x = contexto(d, hoy);
    const fase = faseActual(x);
    const grupos = papeles(d, x.compra, fase, hoy);
    return {
      x,
      fase,
      grupos,
      siguiente: siguientePaso(x, fase),
      tareas: tareas(x),
      proximos: proximos(x, grupos),
      avisos: avisos(x, grupos),
    };
  }, [d, hoy]);
}

export function useCapacidad() {
  const titulares = useApp((s) => s.titulares);
  const ajustes = useApp((s) => s.ajustes);
  const hoy = useHoy();
  return useMemo(() => capacidad(titulares, ajustes, hoy), [titulares, ajustes, hoy]);
}

export function useHipotecas() {
  const hipotecas = useApp((s) => s.hipotecas);
  const euribor = useApp((s) => s.ajustes.euribor);
  return useMemo(() => ordenarHipotecas(hipotecas, euribor), [hipotecas, euribor]);
}

/** Los números de cada casa, por id. */
export function useNumeros() {
  const d = useDatos();
  const hoy = useHoy();
  return useMemo(() => new Map(d.casas.map((c) => [c.id, numerosCasa(c, d, hoy)])), [d, hoy]);
}

export function useCasa(id: string | undefined): Casa | undefined {
  const casas = useApp((s) => s.casas);
  return useMemo(() => casas.find((c) => c.id === id), [casas, id]);
}
