// Apuntar una casa: lo mínimo para empezar a hacer cuentas. El resto, en su ficha.

import { router } from 'expo-router';
import { useMemo, useState } from 'react';

import { Boton, Campo, CampoDinero, Chip, Chips, Interruptor, Pantalla, Seccion } from '@/components/ui';
import { nuevaCasa, useApp } from '@/store/app';

export default function NuevaCasa() {
  const casas = useApp((s) => s.casas);
  const zonas = useMemo(() => [...new Set(casas.map((c) => c.zona).filter(Boolean))].sort(), [casas]);
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState(0);
  const [zona, setZona] = useState('');
  const [nueva, setNueva] = useState(false);
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState<string | null>(null);

  const guardar = () => {
    if (!nombre.trim()) return setError('Ponle un nombre: la calle, el barrio o "el ático de la plaza".');
    const id = nuevaCasa({ nombre: nombre.trim(), precio, zona: zona.trim(), nueva, enlace: enlace.trim() });
    router.replace(`/casa/${id}`);
  };

  return (
    <Pantalla titulo="Nueva casa" atras pie={<Boton texto="Guardar" icono="check" onPress={guardar} />}>
      <Seccion>
        <Campo
          etiqueta="Nombre"
          value={nombre}
          onChangeText={(v) => {
            setNombre(v);
            setError(null);
          }}
          error={error}
          maxLength={50}
          autoFocus
        />
        <CampoDinero etiqueta="Precio" valor={precio} onGuardar={setPrecio} />
        <Campo etiqueta="Zona" value={zona} onChangeText={setZona} maxLength={30} placeholder="Barrio o pueblo" />
        {zonas.length > 0 && (
          <Chips>
            {zonas.map((z) => (
              <Chip key={z} texto={z} activo={zona === z} onPress={() => setZona(z)} />
            ))}
          </Chips>
        )}
        <Interruptor titulo="Obra nueva" ayuda="Paga IVA y AJD en vez de ITP." valor={nueva} onCambio={setNueva} />
        <Campo etiqueta="Anuncio (opcional)" value={enlace} onChangeText={setEnlace} autoCapitalize="none" keyboardType="url" placeholder="Pega el enlace" />
      </Seccion>
    </Pantalla>
  );
}
