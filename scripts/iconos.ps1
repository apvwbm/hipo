# Genera los iconos de HIPO: la "h" minúscula de Archivo 800 sobre teja convertida en
# hipopótamo, con la cabeza arriba del tronco: hocico ancho, ollar y una orejita.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/iconos.ps1
# Solo hace falta volver a ejecutarlo si cambia el diseño del icono.

Add-Type -AssemblyName System.Drawing

$raiz = Split-Path -Parent $PSScriptRoot
$fuente = Join-Path $raiz 'node_modules/@expo-google-fonts/archivo/800ExtraBold/Archivo_800ExtraBold.ttf'
$coleccion = New-Object System.Drawing.Text.PrivateFontCollection
$coleccion.AddFontFile($fuente)
$familia = $coleccion.Families[0]

$acento = [System.Drawing.ColorTranslator]::FromHtml('#9A4A2C')
$blanco = [System.Drawing.Color]::White
$P = { param($x, $y) New-Object System.Drawing.PointF $x, $y }

function Circulo($x, $y, $r) {
  $c = New-Object System.Drawing.Drawing2D.GraphicsPath
  $c.AddEllipse($x - $r, $y - $r, 2 * $r, 2 * $r)
  $c
}

# Las piezas, en coordenadas de la "h" a 0.78 de un lienzo de 1024 y centrada por su caja:
# tronco x 310–441 desde y = 223, el arco empieza a la altura de y = 371. Cada pieza va en
# su propio trazado (si se solapan dentro de uno, lo solapado queda hueco) y se solapan
# unos píxeles (dos bordes que solo se tocan dejan una costura al suavizar).
function Piezas {
  $lado = 1024
  $h = New-Object System.Drawing.Drawing2D.GraphicsPath
  $h.AddString('h', $familia, 0, [single]($lado * 0.78), (& $P 0 0), [System.Drawing.StringFormat]::GenericTypographic)
  $caja = $h.GetBounds()
  $m = New-Object System.Drawing.Drawing2D.Matrix
  $m.Translate(($lado - $caja.Width) / 2 - $caja.X, ($lado - $caja.Height) / 2 - $caja.Y)
  $h.Transform($m)

  # Cabeza mirando a la izquierda: el tronco se ensancha en un hocico con las esquinas de
  # delante redondas (x 196–441, y 223–380).
  $x0 = 196; $abajo = 380; $r = 64
  $hocico = New-Object System.Drawing.Drawing2D.GraphicsPath
  $hocico.AddArc($x0, 223, 2 * $r, 2 * $r, 180, 90); $hocico.AddLine($x0 + $r, 223, 441, 223)
  $hocico.AddLine(441, 223, 441, $abajo); $hocico.AddLine(441, $abajo, $x0 + $r, $abajo)
  $hocico.AddArc($x0, $abajo - 2 * $r, 2 * $r, 2 * $r, 90, 90); $hocico.CloseFigure()

  # La orejita detrás y el ollar delante, asomando por arriba.
  , @($h, $hocico, (Circulo 418 220 22), (Circulo ($x0 + 52) 224 24))
}

# El hipopótamo centrado por su caja, con su lado mayor a `escala` del lienzo.
function Dibujar($archivo, $fondo, $tinta, $escala) {
  $lado = 1024
  $bmp = New-Object System.Drawing.Bitmap $lado, $lado
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear($fondo)
  $piezas = Piezas
  $u = $piezas[0].GetBounds()
  foreach ($p in $piezas) { $u = [System.Drawing.RectangleF]::Union($u, $p.GetBounds()) }
  $k = $lado * $escala / [Math]::Max($u.Width, $u.Height)
  $m = New-Object System.Drawing.Drawing2D.Matrix
  $m.Translate($lado / 2, $lado / 2)
  $m.Scale($k, $k)
  $m.Translate(-($u.X + $u.Width / 2), -($u.Y + $u.Height / 2))
  $pincel = New-Object System.Drawing.SolidBrush $tinta
  foreach ($p in $piezas) { $p.Transform($m); $g.FillPath($pincel, $p) }
  $bmp.Save((Join-Path $raiz "assets/$archivo"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

$transparente = [System.Drawing.Color]::Transparent
Dibujar 'icon.png' $acento $blanco 0.66
# Adaptativo de Android: el sistema recorta un círculo del 66 % central, el hipopótamo va más pequeño.
Dibujar 'android-icon-foreground.png' $transparente $blanco 0.42
Dibujar 'android-icon-monochrome.png' $transparente $blanco 0.42
Dibujar 'splash-icon.png' $transparente $acento 0.66
